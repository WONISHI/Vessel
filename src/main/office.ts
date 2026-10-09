import { app, BrowserWindow, dialog, type WebContents } from "electron"
import { createServer } from "node:http"
import { readFile, realpath, writeFile, stat, rename } from "node:fs/promises"
import { join, resolve, relative, extname, basename, isAbsolute, dirname } from "node:path"
let origin: Promise<string> | undefined
export function serveOffice() {
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
  const documents = new Map<string, string>()
  const owner = () => { const window = BrowserWindow.fromWebContents(host); if (!window) throw new Error("窗口已关闭"); return window }
  const validateName = (name: string) => { if (typeof name !== "string" || !name.trim() || /[\\/:]/.test(name) || name === "." || name === "..") throw new Error("文件名称无效") }
  const readDocument = async (path: string) => {
    if (!isAbsolute(path) || !/\.(pdf|docx?|docs|xlsx?|pptx?|odt|ods|odp|csv)$/i.test(path)) throw new Error("不支持的 Office 文档")
    const info = await stat(path)
    if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error("文档无效或超过 256 MB")
    const token = crypto.randomUUID()
    const bytes = new Uint8Array(await readFile(path))
    documents.set(token, path)
    return { token, name: basename(path).replace(/\.docs$/i, ".docx"), bytes }
  }
  host.ipc.handle("office:read-path", (_event, path: string) => readDocument(path))
  host.ipc.handle("office:pick", async () => {
    const result = await dialog.showOpenDialog(owner(), { title: "打开文档", properties: ["openFile"], filters: [{ name: "Office / PDF 文档", extensions: ["pdf", "docx", "xlsx", "pptx", "doc", "xls", "ppt", "odt", "ods", "odp", "csv"] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const path = result.filePaths[0]
    if ((await stat(path)).size > 256 * 1024 * 1024) throw new Error("文件超过 256 MB")
    const bytes = new Uint8Array(await readFile(path)); const token = crypto.randomUUID()
    documents.set(token, path)
    return { token, name: basename(path), bytes }
  })
  host.ipc.handle("office:commit", async (_event, name: string, bytes: Uint8Array, token?: string) => {
    validateName(name)
    if (!(bytes instanceof Uint8Array) || bytes.byteLength > 256 * 1024 * 1024) throw new Error("文档数据无效")
    let path = token ? documents.get(token) : undefined
    if (token && !path) throw new Error("文件授权已过期，请重新打开")
    // Legacy imports are exported as OOXML; never overwrite them with a different format.
    if (path && extname(path).toLowerCase() !== extname(name).toLowerCase()) path = undefined
    if (!path) {
      const result = await dialog.showSaveDialog(owner(), { title: "保存 Office 文档", defaultPath: name })
      if (result.canceled || !result.filePath) return { saved: false }
      path = result.filePath; token = crypto.randomUUID()
    }
    await writeFile(path, bytes)
    documents.set(token!, path)
    return { saved: true, token, name: basename(path) }
  })
  host.ipc.handle("office:rename", async (_event, token: string | undefined, name: string) => {
    validateName(name)
    if (!token) return name
    const path = documents.get(token)
    if (!path) throw new Error("文件授权已过期，请重新打开")
    if (extname(path).toLowerCase() !== extname(name).toLowerCase()) throw new Error("重命名不能更改文档格式")
    const target = join(dirname(path), name)
    if (target !== path) {
      try { await stat(target); throw new Error("同名文件已存在") } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
      await rename(path, target); documents.set(token, target)
    }
    return name
  })
  host.ipc.handle("office:open", async () => (await serveOffice()) + "/office.html")
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
