import { ipcMain } from "electron"
import { readFile, stat } from "node:fs/promises"
import { isAbsolute } from "node:path"
import { BaseModule } from "../base"

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
  const info = await stat(path)
  if (!info.isFile()) throw new Error("只能读取普通文件")
  return readFile(path, "utf8")
}

/** 将文件读取能力接入主进程生命周期，避免窗口重建时重复注册 IPC。 */
export class FilesModule extends BaseModule {
  protected onActivate(): void {
    ipcMain.handle("file:readContent", (_event, path: unknown) => readTextFileContent(path))
  }

  protected onDispose(): void {
    ipcMain.removeHandler("file:readContent")
  }
}
