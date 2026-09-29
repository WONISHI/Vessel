import { app, BrowserWindow, ipcMain } from "electron"
import { resolve, extname } from "node:path"
import { stat } from "node:fs/promises"

export function markdownArguments(argv: string[], cwd = process.cwd()): string[] {
  return argv.filter((value) => !value.startsWith("-") && /^(\.md|\.markdown)$/i.test(extname(value))).map((value) => resolve(cwd, value))
}
/** 保留启动期间的文件，直到渲染进程注册监听后主动取走。 */
export function registerMarkdownOpening() {
  const pending: string[] = []
  let ready = false
  const enqueue = async (path: string) => {
    try {
      if (!/\.(md|markdown)$/i.test(path) || !(await stat(path)).isFile()) return
      const window = BrowserWindow.getAllWindows()[0]
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
    for (const path of markdownArguments(argv, cwd)) void enqueue(path)
    const window = BrowserWindow.getAllWindows()[0]
    if (window) {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    }
  })
  ipcMain.handle("markdown:pending", () => {
    ready = true
    return pending.splice(0)
  })
  app.on("browser-window-created", (_event, window) => {
    window.webContents.on("did-start-loading", () => {
      ready = false
    })
    window.on("closed", () => {
      ready = false
    })
  })
  for (const path of markdownArguments(process.argv)) void enqueue(path)
}
