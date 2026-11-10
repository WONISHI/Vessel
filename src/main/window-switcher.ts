import { app, BrowserWindow, type WebContents } from "electron"

let picker: BrowserWindow | undefined
let windows: BrowserWindow[] = []
let selected = 0
let generation = 0
const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

function focusWindow(window: BrowserWindow | undefined) {
  if (!window || window.isDestroyed()) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

function select() {
  const target = windows[selected]
  picker?.close()
  focusWindow(target)
}

function move(delta: number) {
  if (!windows.length) return
  selected = (selected + delta + windows.length) % windows.length
  void picker?.webContents.executeJavaScript(`document.querySelectorAll("a").forEach((a,i)=>a.classList.toggle("selected",i===${selected}));document.querySelector(".selected")?.scrollIntoView({block:"nearest"})`).catch(() => {})
}

/** Top-level Vessel windows that can be switched to, with the focused one first. */
function listWindows(current: BrowserWindow | null) {
  return BrowserWindow.getAllWindows()
    .filter((window) => !window.isDestroyed() && window !== picker && (window.isVisible() || window.isMinimized()) && !window.getParentWindow() && !window.webContents.getURL().startsWith("devtools://"))
    .sort((a, b) => Number(b.id === current?.id) - Number(a.id === current?.id))
}

/** Switches directly to the next Vessel window without showing the picker. */
function cycle() {
  const current = BrowserWindow.getFocusedWindow()
  const candidates = listWindows(current)
  if (candidates.length < 2) return
  const index = candidates.findIndex((window) => window.id === current?.id)
  focusWindow(candidates[(index + 1) % candidates.length])
}

async function show() {
  if (picker && !picker.isDestroyed()) { move(1); return }
  const current = BrowserWindow.getFocusedWindow()
  if (!current) return
  windows = listWindows(current)
  if (windows.length < 2) return
  selected = 0
  const revision = ++generation
  const win = new BrowserWindow({
    width: Math.min(980, windows.length * 260 + 48), height: 300,
    frame: false, resizable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, show: false, skipTaskbar: true,
    backgroundColor: "#23272d",
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  picker = win
  win.on("closed", () => { if (picker === win) { picker = undefined; windows = []; generation++ } })
  win.on("blur", () => { if (!win.isDestroyed()) win.close() })
  win.webContents.on("will-navigate", (event, url) => {
    event.preventDefault()
    const match = /^https:\/\/vessel-window\.invalid\/(\d+)$/.exec(url)
    if (!match) return
    const index = windows.findIndex((window) => window.id === Number(match[1]))
    if (index >= 0) { selected = index; select() }
  })
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
  const previews = await Promise.all(windows.map(async (window) => {
    const title = escape(window.getTitle() || "Vessel")
    const id = window.id
    const capture = await Promise.race([
      window.webContents.capturePage().then((image) => image.resize({ width: 240, height: 160 }).toDataURL()).catch(() => ""),
      new Promise<string>((resolve) => { const timer = setTimeout(() => resolve(""), 1200); timer.unref() })
    ])
    return `<a href="https://vessel-window.invalid/${id}"><div class="preview">${capture ? `<img src="${capture}">` : "Vessel"}</div><div class="title">${title}</div></a>`
  }))
  if (revision !== generation || win.isDestroyed()) return
  const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
body{margin:0;padding:20px;background:#23272d;color:#eee;font:13px system-ui}h1{font-size:14px;margin:0 0 14px;font-weight:500}main{display:flex;gap:12px;overflow:auto}a{display:block;flex:0 0 240px;padding:6px;border:2px solid transparent;border-radius:10px;color:inherit;text-decoration:none}a:focus{outline:none}a.selected{border-color:#22c55e;background:#ffffff0c}a:hover:not(.selected),a:focus:not(.selected){border-color:#d4d4d8;background:#ffffff08}.preview{height:160px;background:#181b20;border-radius:5px;display:flex;align-items:center;justify-content:center;overflow:hidden}img{width:100%;height:100%;object-fit:contain}.title{padding:8px 2px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style><h1>切换 Vessel 窗口</h1><main>${previews.join("")}</main>`
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html))
  if (win.isDestroyed()) return
  win.show()
  win.focus()
  move(0)
}

const shortcutModifier = (input: Electron.Input) =>
  process.platform === "darwin" ? input.meta && !input.alt : input.alt && !input.meta

/** Captures the window-switching shortcut in app windows and embedded browser pages. */
export function registerWindowSwitcher() {
  app.on("web-contents-created", (_event, contents: WebContents) => {
    contents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown" && !input.control && !input.shift && shortcutModifier(input)) {
        if (input.code === "KeyE") {
          event.preventDefault()
          if (!input.isAutoRepeat) void show().catch(console.error)
          return
        }
        if (input.code === "KeyT") {
          event.preventDefault()
          if (!input.isAutoRepeat) cycle()
          return
        }
      }
      if (!picker || contents !== picker.webContents) return
      if (input.type === "keyUp" && (process.platform === "darwin" ? input.key === "Meta" : input.key === "Alt")) { event.preventDefault(); select(); return }
      if (input.type !== "keyDown") return
      if (input.key === "Escape") { event.preventDefault(); picker.close() }
      if (input.key === "Enter") { event.preventDefault(); select() }
      if (input.key === "ArrowRight" || input.key === "ArrowLeft") { event.preventDefault(); move(input.key === "ArrowRight" ? 1 : -1) }
    })
  })
}
