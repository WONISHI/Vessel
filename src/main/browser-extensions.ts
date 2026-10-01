import { importExtensionArchive } from "./extension-archive"
import { app, BrowserWindow, dialog, session, type WebContents } from "electron"
import { readFile, writeFile, rename, realpath, rm } from "node:fs/promises"
import { join, dirname, basename } from "node:path"
import { randomUUID } from "node:crypto"
import type { BrowserExtension } from "../shared/browser-extensions"

let records: BrowserExtension[] = []
let initialized: Promise<void> | undefined
let queue = Promise.resolve()
const extensions = () => session.fromPartition("persist:vessel-browser").extensions
const filename = () => join(app.getPath("userData"), "browser-extensions.json")
const persist = async () => {
  await writeFile(filename() + ".tmp", JSON.stringify(records, null, 2), "utf8")
  await rename(filename() + ".tmp", filename())
}
async function load(record: BrowserExtension) {
  try {
    const extension = await extensions().loadExtension(record.path)
    Object.assign(record, { extensionId: extension.id, name: extension.name, version: extension.version, error: undefined })
  } catch (error) { record.error = String(error); record.extensionId = undefined }
}
function initialize() {
  return initialized ||= (async () => {
    try {
      const saved: unknown = JSON.parse(await readFile(filename(), "utf8"))
      if (!Array.isArray(saved)) throw new Error("扩展配置格式无效")
      records = saved.filter(record => record && typeof record.key === "string" && typeof record.path === "string" && typeof record.enabled === "boolean")
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("读取扩展列表失败", error) }
    for (const record of records) { record.extensionId = undefined; if (record.enabled) await load(record) }
  })()
}
export function registerBrowserExtensions(host: WebContents) {
  void initialize()
  const mutate = (action: () => Promise<void>) => {
    const operation = queue.then(async () => { await initialize(); await action(); await persist(); return records.map(record => ({ ...record })) })
    queue = operation.then(() => {}, () => {})
    return operation
  }
  host.ipc.handle("browser:extensions:list", async () => { await initialize(); await queue; return records })
  host.ipc.handle("browser:extensions:install", async (_event, kind: "archive" | "directory" = "directory") => {
    if (!["archive", "directory"].includes(kind)) throw new Error("安装类型无效")
    const window = BrowserWindow.fromWebContents(host)
    if (!window) throw new Error("窗口已关闭")
    const result = await dialog.showOpenDialog(window, kind === "archive"
      ? { title: "选择 CRX 或 ZIP 扩展包", properties: ["openFile"], filters: [{ name: "Chrome 扩展包", extensions: ["crx", "zip"] }] }
      : { title: "选择解压后的扩展目录（包含 manifest.json）", properties: ["openDirectory"] })
    if (result.canceled) { await initialize(); return records }
    let path = await realpath(result.filePaths[0])
    let imported: Awaited<ReturnType<typeof importExtensionArchive>> | undefined
    let retained = false
    try {
      if (kind === "archive") {
        imported = await importExtensionArchive(path, join(app.getPath("userData"), "browser-extension-packages"))
        let index = 0
        if (imported.candidates.length > 1) {
          const choice = await dialog.showMessageBox(window, { type: "question", title: "选择要安装的扩展", message: "压缩包中有多个扩展或版本", buttons: [...imported.candidates.map(item => item.label), "取消"], cancelId: imported.candidates.length, noLink: true })
          if (choice.response >= imported.candidates.length) { await initialize(); return records }
          index = choice.response
        }
        path = imported.candidates[index].path
      }
      const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"))
      if (!manifest.name || !manifest.version || ![2, 3].includes(manifest.manifest_version)) throw new Error("请选择包含有效 manifest.json 的扩展目录")
      return await mutate(async () => {
        let record = records.find(item => item.path === path || (imported && item.archiveDigest === imported.digest && item.name === manifest.name && item.version === manifest.version))
        if (!record) {
          record = { key: randomUUID(), path, name: manifest.name, version: manifest.version, enabled: true, managedDirectory: imported?.directory, archiveDigest: imported?.digest }
          records.push(record); retained = true
        }
        if (!record.extensionId) { record.enabled = true; await load(record) }
      })
    } finally { if (imported && !retained) await rm(imported.directory, { recursive: true, force: true }) }
  })
  host.ipc.handle("browser:extensions:enabled", (_event, key: string, enabled: boolean) => mutate(async () => {
    if (typeof enabled !== "boolean") throw new Error("扩展状态无效")
    const record = records.find(item => item.key === key)
    if (!record) throw new Error("扩展不存在")
    if (record.extensionId) extensions().removeExtension(record.extensionId)
    record.extensionId = undefined; record.error = undefined; record.enabled = enabled
    if (enabled) await load(record)
  }))
  host.ipc.handle("browser:extensions:remove", (_event, key: string) => mutate(async () => {
    const record = records.find(item => item.key === key)
    if (record?.extensionId) extensions().removeExtension(record.extensionId)
    records = records.filter(item => item.key !== key)
    if (record?.managedDirectory && dirname(record.managedDirectory) === join(app.getPath("userData"), "browser-extension-packages") && basename(record.managedDirectory).startsWith("import-")) await rm(record.managedDirectory, { recursive: true, force: true })
  }))
}
