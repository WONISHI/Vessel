import { registerOffice } from "@main/office/office"
import { registerTransit } from "@main/transit/transit"
import { app, BrowserWindow } from "electron"
import { basename, dirname, extname, join } from "node:path"

const formats = new Set([".md", ".markdown", ".pdf", ".doc", ".docx", ".docs", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".csv", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp", ".ico", ".avif"])
type PreviewTab = { id: string; kind: "file"; title: string; root: string; content: string }
let preview: { win: BrowserWindow; tabs: PreviewTab[]; selected: string } | undefined
const fileTab = (file: string): PreviewTab => ({ id: file, kind: "file", title: basename(file), root: dirname(file), content: file })
export const usesPreviewWindow = (path: string) => formats.has(extname(path).toLowerCase())

/** OS-opened documents use a focused preview, independent of the workspace window. */
export async function openFilePreviewWindow(path: string, paths: string[] = [path]) {
  await app.whenReady()
  const existing = preview?.win
  if (preview && existing && !existing.isDestroyed()) {
    for (const file of [...paths, path]) {
      if (!preview.tabs.some((tab) => tab.id === file)) preview.tabs.push(fileTab(file))
    }
    preview.selected = path
    existing.setTitle(basename(path))
    existing.webContents.send("preview:updated", { items: preview.tabs, selected: path })
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return
  }
  const win = new BrowserWindow({ width: 1050, height: 800, minWidth: 500, minHeight: 360, frame: true, show: false, title: basename(path), backgroundColor: "#faf9f7", webPreferences: { preload: join(__dirname, "../preload/index.js"), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  const state = { win, tabs: [...new Set([...paths, path])].map(fileTab), selected: path }
  preview = state
  win.on("closed", () => { if (preview === state) preview = undefined })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  win.webContents.on("will-navigate", (event) => event.preventDefault())
  win.webContents.ipc.handle("app:reload", () => win.webContents.reload())
  win.webContents.ipc.handle("app:report-crash", () => {})
  registerOffice(win.webContents)
  registerTransit(win.webContents)
  win.webContents.ipc.handle("preview:tabs", () => state.tabs)
  win.webContents.ipc.handle("preview:data", () => fileTab(state.selected))
  win.webContents.ipc.handle("preview:action", (_event, action: string) => {
    if (action === "close") win.close()
    else if (action === "maximize") win.isMaximized() ? win.unmaximize() : win.maximize()
    else if (action === "minimize") win.minimize()
  })
  win.once("ready-to-show", () => win.show())
  try {
    const url = process.env.ELECTRON_RENDERER_URL
    if (url) await win.loadURL(`${url}/?standalonePreview=1`)
    else await win.loadFile(join(__dirname, "../renderer/index.html"), { query: { standalonePreview: "1" } })
  } catch (error) {
    win.destroy()
    throw error
  }
}
