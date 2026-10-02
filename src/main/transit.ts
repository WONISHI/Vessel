import { serveOffice } from "./office"
import { readFile, realpath, stat } from "node:fs/promises"
import { relative, isAbsolute, extname, basename } from "node:path"
import type { TransitFile } from "../shared/transit"
import { BrowserWindow, clipboard, type WebContents } from "electron"

async function readTransitFile(root: string, file: string): Promise<TransitFile> {
    const base = await realpath(root); const path = await realpath(file); const rel = relative(base, path)
    if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("文件不在工作区内")
    if ((await stat(path)).size > 50 * 1024 * 1024) throw new Error("预览文件不能超过 50 MB")
    const extension = extname(path).toLowerCase()
    if (/^\.(docx?|xlsx?|pptx?|odt|ods|odp)$/.test(extension)) return { kind: "office", bytes: new Uint8Array(await readFile(path)), name: basename(path) }
    const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" }[extension]
    if (mime) return { kind: "image", content: `data:${mime};base64,${(await readFile(path)).toString("base64")}` }
    if (!/^\.(md|markdown|txt|json|js|jsx|ts|tsx|css|html|xml|yaml|yml|csv|log|py|sh|sql)$/.test(extension)) throw new Error("暂不支持此文件格式的预览")
    return { kind: /^\.(md|markdown)$/.test(extension) ? "markdown" : "text", content: await readFile(path, "utf8") }
}
export function registerTransit(host: WebContents) {
  host.ipc.handle("transit:read-file", (_event, root: string, file: string) => readTransitFile(root, file))
  host.ipc.handle("transit:clipboard", () => clipboard.readText())
  host.ipc.handle("transit:window", async (_event, item: { kind: string; content: string; title: string; root?: string }) => {
    if (!item || typeof item.content !== "string" || item.content.length > 1_000_000) throw new Error("中转站内容无效")
    const file = item.kind === "file" && item.root ? await readTransitFile(item.root, item.content) : undefined
    if (!file && item.kind !== "text" && (item.kind !== "url" || !/^https?:\/\//i.test(item.content))) throw new Error("不支持此地址")
    const win = new BrowserWindow({ width: 900, height: 720, title: String(item.title).slice(0, 200), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: "persist:vessel-transit" } })
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    win.webContents.on("will-navigate", (event, url) => { if (!/^https?:\/\//i.test(url)) event.preventDefault() })
    const escape = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
    try {
      if (file?.kind === "office") {
        await win.loadURL((await serveOffice()) + "/office.html?editor=1&preview=1")
        await win.webContents.executeJavaScript(`window.postMessage({type:"office:init",doc:{id:"preview",name:${JSON.stringify(file.name)},file:new File([Uint8Array.from(atob(${JSON.stringify(Buffer.from(file.bytes).toString("base64"))}),c=>c.charCodeAt(0))],${JSON.stringify(file.name)})}},location.origin)`)
        return
      }
      const content = file ? file.content : item.content
      const body = file?.kind === "image" ? `<img style="max-width:100%" src="${content}">` : `<pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;font:15px/1.8 system-ui">${escape(content)}</pre>`
      await win.loadURL(item.kind === "url" ? item.content : `data:text/html;charset=utf-8,${encodeURIComponent(`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><title>${escape(item.title)}</title>${body}`)}`)
    } catch (error) { win.destroy(); throw error }
  })
}
