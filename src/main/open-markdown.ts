import { statSync } from "node:fs"
import { app, BrowserWindow, ipcMain } from "electron"
import { resolve, extname, basename, dirname, isAbsolute } from "node:path"
import { stat } from "node:fs/promises"

const supported = new Set([".md", ".markdown", ".txt", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts", ".json", ".html", ".htm", ".css", ".scss", ".less", ".vue", ".svelte", ".yaml", ".yml", ".xml", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h", ".sh", ".sql", ".env", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif", ".pdf", ".doc", ".docx", ".docs", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".csv"])

function isDirectory(path: string) { try { return statSync(path).isDirectory() } catch { return false } }

export async function externalPathInfo(path: string) {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("路径无效")
  const info = await stat(path)
  if (!info.isDirectory() && !info.isFile()) throw new Error("不支持此文件类型")
  return { path, name: basename(path) || path, root: dirname(path), kind: info.isDirectory() ? "directory" as const : "file" as const }
}

export function markdownArguments(argv: string[], cwd = process.cwd()): string[] {
  return argv.filter((value) => !value.startsWith("-") && (supported.has(extname(value).toLowerCase()) || isDirectory(resolve(cwd, value)))).map((value) => resolve(cwd, value))
}
/** 保留启动期间的文件，直到渲染进程注册监听后主动取走。 */
export function registerMarkdownOpening() {
  ipcMain.handle("external:path-info", (_event, path: string) => externalPathInfo(path))
  const pending: string[] = []
  let ready = false
  let receiver: Electron.WebContents | undefined
  const enqueue = async (path: string) => {
    try {
      const info = await externalPathInfo(path)
      if (info.kind === "file" && !supported.has(extname(path).toLowerCase())) return
      const window = receiver && !receiver.isDestroyed() ? BrowserWindow.fromWebContents(receiver) : BrowserWindow.getAllWindows()[0]
      if (window) {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
      if (ready && window) window.webContents.send("markdown:open", path)
      else pending.push(path)
    } catch {
      /* 已移动或不存在的文件不会阻止应用启动。 */
    }
  }
  app.on("open-file", (event, path) => {
    event.preventDefault()
    void enqueue(path)
  })
  app.on("second-instance", (_event, argv, cwd) => {
    for (const path of markdownArguments(argv.slice(app.isPackaged ? 1 : 2), cwd)) void enqueue(path)
    const window = receiver && !receiver.isDestroyed() ? BrowserWindow.fromWebContents(receiver) : BrowserWindow.getAllWindows()[0]
    if (window) {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    }
  })
  ipcMain.handle("markdown:pending", event => {
    const sender = event?.sender
    if (sender && receiver !== sender) {
      receiver = sender
      // Subframe loads (including Office) and auxiliary windows must not pause delivery.
      sender.on("did-start-navigation", (_event, _url, inPlace, isMainFrame) => {
        if (receiver === sender && isMainFrame && !inPlace) ready = false
      })
      sender.once("destroyed", () => { if (receiver === sender) { ready = false; receiver = undefined } })
    }
    ready = true
    return pending.splice(0)
  })
  for (const path of markdownArguments(process.argv.slice(app.isPackaged ? 1 : 2))) void enqueue(path)
}
