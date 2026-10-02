import { app, BrowserWindow, dialog, type WebContents } from "electron"
import { createServer } from "node:http"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { join, resolve, relative, extname, basename, isAbsolute } from "node:path"
let origin: Promise<string> | undefined
function serve() {
  return origin ||= new Promise((done, reject) => {
    const renderer = resolve(__dirname, "../renderer")
    const assets = app.isPackaged ? join(process.resourcesPath, "office") : join(app.getAppPath(), "resources/office")
    const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" }
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname)
        res.setHeader("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' data: blob:; frame-src 'self' blob: data:")
        const isOffice = pathname.startsWith("/office/")
        const developmentURL = !app.isPackaged && process.env.ELECTRON_RENDERER_URL
        if (!isOffice && developmentURL) {
          const response = await fetch(new URL(req.url || "/", developmentURL))
          res.statusCode = response.status
          res.setHeader("Content-Type", response.headers.get("content-type") || "application/octet-stream")
          res.end(Buffer.from(await response.arrayBuffer()))
          return
        }
        const root = await realpath(isOffice ? assets : renderer)
        const path = await realpath(resolve(root, "." + (isOffice ? pathname.slice(7) : pathname)))
        const rel = relative(root, path)
        if (rel.startsWith("..") || isAbsolute(rel) || !["GET", "HEAD"].includes(req.method || "")) { res.writeHead(403).end(); return }
        const data = await readFile(path)
        res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream")
        res.end(req.method === "HEAD" ? undefined : data)
      } catch { res.writeHead(404).end("Not found") }
    })
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => { const address = server.address(); if (address && typeof address !== "string") done(`http://127.0.0.1:${address.port}`) })
    app.once("will-quit", () => server.close())
  })
}
export function registerOffice(host: WebContents) {
  host.ipc.handle("office:open", async () => (await serve()) + "/office.html")
  host.ipc.handle("office:save", async (_event, name: string, bytes: Uint8Array) => {
    if (typeof name !== "string" || !(bytes instanceof Uint8Array) || bytes.byteLength > 256 * 1024 * 1024) throw new Error("文档数据无效或超过 256 MB")
    const window = BrowserWindow.fromWebContents(host)
    if (!window) throw new Error("窗口已关闭")
    const result = await dialog.showSaveDialog(window, { title: "另存为 Office 文档", defaultPath: basename(name) })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, bytes)
    return true
  })
}
