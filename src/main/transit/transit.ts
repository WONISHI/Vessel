import type { TransitFile } from "@vessel/type"
import { app, BrowserWindow, clipboard, dialog, type WebContents } from "electron"
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative } from "node:path"

/** Reads transit file. */
async function readTransitFile(root: string, file: string): Promise<TransitFile> {
  const base = await realpath(root)
  const path = await realpath(file)
  const rel = relative(base, path)
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("文件不在工作区内")
  if ((await stat(path)).size > 50 * 1024 * 1024) throw new Error("预览文件不能超过 50 MB")
  const extension = extname(path).toLowerCase()
  if (/^\.(docx?|docs|xlsx?|pptx?|odt|ods|odp|csv)$/.test(extension)) return { kind: "office", bytes: new Uint8Array(await readFile(path)), name: basename(path) }
  if (extension === ".pdf") return { kind: "pdf", bytes: new Uint8Array(await readFile(path)), name: basename(path) }
  const mime = { ".svg": "image/svg+xml", ".bmp": "image/bmp", ".ico": "image/x-icon", ".avif": "image/avif", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" }[extension]
  if (mime) return { kind: "image", content: `data:${mime};base64,${(await readFile(path)).toString("base64")}` }
  if (!/^\.(md|markdown|txt|json|js|jsx|ts|tsx|css|html|xml|yaml|yml|csv|log|py|sh|sql)$/.test(extension)) throw new Error("暂不支持此文件格式的预览")
  return { kind: /^\.(md|markdown)$/.test(extension) ? "markdown" : "text", content: await readFile(path, "utf8") }
}

/** Registers transit. */
export function registerTransit(host: WebContents) {
  host.ipc.handle("transit:import-files", async () => {
    const owner = BrowserWindow.fromWebContents(host)
    if (!owner) throw new Error("窗口已关闭")
    const extensions = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "pdf", "png", "jpg", "jpeg", "gif", "webp", "md", "markdown", "txt", "json", "js", "jsx", "ts", "tsx", "css", "html", "xml", "yaml", "yml", "csv", "log", "py", "sh", "sql"]
    const result = await dialog.showOpenDialog(owner, { title: "导入文件到中转站", properties: ["openFile", "multiSelections"], filters: [{ name: "可预览文件", extensions }] })
    if (result.canceled) return []
    return Promise.all(
      result.filePaths.map(async (file) => {
        const path = await realpath(file)
        const info = await stat(path)
        if (!info.isFile() || info.size > 50 * 1024 * 1024) throw new Error(`${basename(path)}：预览文件不能超过 50 MB`)
        if (!extensions.includes(extname(path).slice(1).toLowerCase())) throw new Error("暂不支持此文件格式的预览")
        return { root: dirname(path), path, title: basename(path) }
      })
    )
  })
  host.ipc.handle("transit:read-file", (_event, root: string, file: string) => readTransitFile(root, file))
  host.ipc.handle("transit:clipboard", async () => {
    const image = clipboard.readImage()
    if (image.isEmpty()) return clipboard.readText()
    const root = join(app.getPath("userData"), "transit-images")
    await mkdir(root, { recursive: true })
    const title = `剪贴板截图-${Date.now()}.png`
    const path = join(root, title)
    await writeFile(path, image.toPNG())
    return { root, path, title }
  })
  host.ipc.handle("transit:window", async (_event, item: { kind: string; content: string; title: string; root?: string }, tabs?: { root: string; content: string }[]) => {
    if (!item || typeof item.content !== "string" || item.content.length > 1_000_000) throw new Error("中转站内容无效")
    const file = item.kind === "file" && item.root ? await readTransitFile(item.root, item.content) : undefined
    if (!file && item.kind !== "text" && (item.kind !== "url" || !/^https?:\/\//i.test(item.content))) throw new Error("不支持此地址")
    if (file) {
      const { openFilePreviewWindow } = await import("@main/files/preview-window")
      const paths = [item.content]
      if (Array.isArray(tabs)) {
        for (const tab of tabs.slice(0, 50)) {
          if (!tab || typeof tab.root !== "string" || typeof tab.content !== "string") continue
          try { await readTransitFile(tab.root, tab.content); paths.push(tab.content) } catch { /* Missing files are omitted. */ }
        }
      }
      await openFilePreviewWindow(item.content, paths)
      return
    }
    const win = new BrowserWindow({ width: 900, height: 720, title: String(item.title).slice(0, 200), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: "persist:vessel-transit" } })
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    win.webContents.on("will-navigate", (event, url) => {
      if (!/^https?:\/\//i.test(url)) event.preventDefault()
    })

    /** Escapes escape. */
    const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
    try {
      const content = item.content
      const body = `<pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;font:15px/1.8 system-ui">${escape(content)}</pre>`
      await win.loadURL(item.kind === "url" ? item.content : `data:text/html;charset=utf-8,${encodeURIComponent(`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${escape(item.title)}</title>${body}`)}`)
    } catch (error) {
      win.destroy()
      throw error
    }
  })
}
