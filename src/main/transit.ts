import { BrowserWindow, clipboard, type WebContents } from "electron"

export function registerTransit(host: WebContents) {
  host.ipc.handle("transit:clipboard", () => clipboard.readText())
  host.ipc.handle("transit:window", async (_event, item: { kind: string; content: string; title: string }) => {
    if (!item || typeof item.content !== "string" || item.content.length > 1_000_000) throw new Error("中转站内容无效")
    if (item.kind !== "text" && (item.kind !== "url" || !/^https?:\/\//i.test(item.content))) throw new Error("不支持此地址")
    const win = new BrowserWindow({ width: 900, height: 720, title: String(item.title).slice(0, 200), webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: "persist:vessel-browser" } })
    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    win.webContents.on("will-navigate", (event, url) => { if (!/^https?:\/\//i.test(url)) event.preventDefault() })
    const escape = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`)
    try {
      await win.loadURL(item.kind === "url" ? item.content : `data:text/html;charset=utf-8,${encodeURIComponent(`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(item.title)}</title><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;font:15px/1.8 system-ui">${escape(item.content)}</pre>`)}`)
    } catch (error) { win.destroy(); throw error }
  })
}
