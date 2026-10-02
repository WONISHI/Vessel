import { app, BrowserWindow, dialog, type WebContents } from "electron"
import { createServer } from "node:http"
import { readFile, realpath, writeFile } from "node:fs/promises"
import { join, resolve, relative, extname, basename, isAbsolute } from "node:path"
let office: BrowserWindow | undefined
let origin: Promise<string> | undefined
function serve() {
  return origin ||= new Promise((done, reject) => {
    const renderer = resolve(__dirname, "../renderer")
    const assets = app.isPackaged ? join(process.resourcesPath, "office") : resolve("resources/office")
    const types = { ".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" }
    const server = createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname)
        const isOffice = pathname.startsWith("/office/")
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
  host.ipc.handle("office:open", async () => {
    if (office && !office.isDestroyed()) { office.show(); office.focus(); return }
    const base = await serve()
    office = new BrowserWindow({ width: 1200, height: 800, title: "ONLYOFFICE", webPreferences: { preload: join(__dirname, "../preload/office.js"), sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const window = office
    window.on("closed", () => { if (office === window) office = undefined })
    window.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    window.webContents.on("will-navigate", (event, url) => { if (!url.startsWith(base + "/")) event.preventDefault() })
    window.webContents.ipc.handle("office:save", async (_event, name: string, bytes: Uint8Array) => {
      if (typeof name !== "string" || !(bytes instanceof Uint8Array) || bytes.byteLength > 256 * 1024 * 1024) throw new Error("文档数据无效或超过 256 MB")
      const result = await dialog.showSaveDialog(window, { title: "保存 Office 文档", defaultPath: basename(name) })
      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, bytes)
      return true
    })
    await window.loadURL(base + "/office.html")
  })
}
