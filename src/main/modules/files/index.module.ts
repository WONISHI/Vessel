import { copyImage } from "./copy-image"
import { getCodeDiagnostics, disposeCodeDiagnostics } from "../../code-diagnostics"
import { readWikiLink } from "./wiki-link"
import { readImageFile } from "./image-file"
import { readObsidianImage } from "./obsidian-image"
import { ipcMain, shell, clipboard } from "electron"
import { readFile, stat, realpath, mkdir, writeFile, link, unlink, rename, lstat } from "node:fs/promises"
import { isAbsolute, relative, join, sep, dirname } from "node:path"
import { BaseModule } from "../base"

const pendingWrites = new Map<string, Promise<void>>()

export function saveTextFileContent(path: unknown, content: unknown): Promise<void> {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0") || typeof content !== "string") {
    return Promise.reject(new TypeError("文件路径或内容无效"))
  }
  const previous = pendingWrites.get(path) ?? Promise.resolve()
  const write = previous.catch(() => {}).then(async () => {
    if (!(await stat(path)).isFile()) throw new Error("只能保存普通文件")
    await writeFile(path, content, "utf8")
  })
  pendingWrites.set(path, write)
  const cleanup = () => { if (pendingWrites.get(path) === write) pendingWrites.delete(path) }
  void write.then(cleanup, cleanup)
  return write
}

/**
 * 读取本地文本文件，为 Markdown、JSON 编辑器提供 UTF-8 内容。
 * @param path 文件的绝对路径。
 * @returns 文件原始文本，不进行 JSON 解析或 Markdown 转换。
 * @throws 路径非法、不是普通文件或读取失败时抛出错误。
 */
export async function readTextFileContent(path: unknown): Promise<string> {
  if (typeof path !== "string" || !isAbsolute(path) || path.includes("\0")) {
    throw new TypeError("文件路径必须为有效的绝对路径")
  }
  await pendingWrites.get(path)
  const info = await stat(path)
  if (!info.isFile()) throw new Error("只能读取普通文件")
  return readFile(path, "utf8")
}

/** 在工作区内创建单个节点，拒绝越界路径、符号链接逃逸和覆盖已有文件。 */
export async function createWorkspaceEntry(root: string, parent: string, name: string, kind: "file" | "directory") {
  if (!isAbsolute(root) || !isAbsolute(parent) || !name.trim() || /[\\/\0]/.test(name) || name === "." || name === "..") throw new Error("名称或路径无效")
  if (kind !== "file" && kind !== "directory") throw new Error("节点类型无效")
  const base = await realpath(root)
  const directory = await realpath(parent)
  const offset = relative(base, directory)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("只能在当前工作区创建")
  const path = join(directory, name)
  try {
    if (kind === "directory") await mkdir(path)
    else await writeFile(path, "", { flag: "wx" })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`“${name}”已存在，请使用其他名称`)
    throw error
  }
  return { name, path, type: kind }
}

/** 修改工作区普通文件；删除移入系统废纸篓，重命名禁止覆盖。 */
export async function mutateWorkspaceFile(root: string, path: string, name?: string) {
  const base = await realpath(root)
  const source = await realpath(path)
  const offset = relative(base, source)
  if (!offset || offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset) || (!(await stat(source)).isFile() && !(await stat(source)).isDirectory())) throw new Error("只能操作工作区内的普通文件")
  if (name === undefined) {
    await shell.trashItem(source)
    return ""
  }
  if (!name.trim() || /[\\/\0]/.test(name) || name === "." || name === "..") throw new Error("文件名无效")
  const target = join(dirname(source), name)
  if (target === source) return target
  if ((await stat(source)).isDirectory()) {
    const exists = await lstat(target).then(
      () => true,
      (error) => {
        if (error.code === "ENOENT") return false
        throw error
      }
    )
    if (exists) throw new Error("目标名称已存在")
    await rename(source, target)
    return target
  }
  await link(source, target)
  try {
    await unlink(source)
  } catch (error) {
    await unlink(target)
    throw error
  }
  return target
}

/** 将文件读取能力接入主进程生命周期，避免窗口重建时重复注册 IPC。 */
export class FilesModule extends BaseModule {
  protected onActivate(): void {
    ipcMain.handle("code:diagnostics", (_event, path, content) => getCodeDiagnostics(path, content))
    ipcMain.handle("workspace:revealFile", async (_event, root: string, path: string) => {
      const base = await realpath(root),
        source = await realpath(path),
        offset = relative(base, source)
      if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("路径不在工作区")
      shell.showItemInFolder(source)
    })
    ipcMain.handle("obsidian:readWikiLink", (_event, root, target) => readWikiLink(root, target))
    ipcMain.handle("image:clipboard", () => { const image = clipboard.readImage(); if (image.isEmpty()) return null; const data = image.toPNG(); if (data.length > 30_000_000) throw new Error("剪贴板图片超过 30 MB"); return `data:image/png;base64,${data.toString("base64")}` })
    ipcMain.handle("image:copy", (_event, source) => copyImage(source))
    ipcMain.handle("image:readFile", (_event, root, path) => readImageFile(root, path))
    ipcMain.handle("obsidian:readImage", (_event, root, documentPath, reference) => readObsidianImage(root, documentPath, reference))
    ipcMain.handle("workspace:mutateFile", (_event, root, path, name) => mutateWorkspaceFile(root, path, name))
    ipcMain.handle("workspace:createEntry", (_event, root, parent, name, kind) => createWorkspaceEntry(root, parent, name, kind))
    ipcMain.handle("link:openExternal", async (_event, href: string) => {
      const url = new URL(href)
      if (!["https:", "http:", "mailto:"].includes(url.protocol)) throw new Error("不支持的链接协议")
      await shell.openExternal(url.href)
    })
    ipcMain.handle("file:saveContent", (_event, path: unknown, content: unknown) => saveTextFileContent(path, content))
    ipcMain.handle("file:readContent", (_event, path: unknown) => readTextFileContent(path))
  }

  protected onDispose(): void {
    ipcMain.removeHandler("code:diagnostics")
    disposeCodeDiagnostics()
    ipcMain.removeHandler("workspace:revealFile")
    ipcMain.removeHandler("obsidian:readWikiLink")
    ipcMain.removeHandler("image:copy")
    ipcMain.removeHandler("image:readFile")
    ipcMain.removeHandler("obsidian:readImage")
    ipcMain.removeHandler("workspace:mutateFile")
    ipcMain.removeHandler("file:readContent")
    ipcMain.removeHandler("file:saveContent")
    ipcMain.removeHandler("workspace:createEntry")
    ipcMain.removeHandler("link:openExternal")
  }
}
