import type { FileMenuCommand, FileMenuState } from "@vessel/type"
import { installFileMenuDialog } from "./file-dialog"
import { app, BrowserWindow, ipcMain, Menu, MenuItem, type MenuItemConstructorOptions } from "electron"

/** Builds the full native menu template based on current application state. */
function buildMenuTemplate(
  state: Partial<FileMenuState>,
  send: (command: FileMenuCommand | "recent", path?: string, kind?: "file" | "workspace") => void,
  getWindow: () => BrowserWindow | undefined
): MenuItemConstructorOptions[] {
  const applicationMenu: MenuItemConstructorOptions = {
    label: "Vessel",
    submenu: [
      {
        label: "关于 Vessel",
        /** Displays Vessel's native application information. */
        click: () => app.showAboutPanel()
      },
      { type: "separator" },
      {
        label: "设置…",
        accelerator: "CommandOrControl+,",
        /** Opens the application's settings page in its main window. */
        click: () => {
          const window = getWindow()
          if (!window || window.isDestroyed()) return
          if (window.isMinimized()) window.restore()
          window.show()
          window.focus()
          window.webContents.send("app:open-settings")
        }
      },
      { type: "separator" },
      { label: "服务", role: "services" },
      { type: "separator" },
      { label: "隐藏 Vessel", role: "hide" },
      { label: "隐藏其他应用", role: "hideOthers" },
      { label: "显示全部", role: "unhide" },
      { type: "separator" },
      { label: "退出 Vessel", role: "quit" }
    ]
  }

  const recentEntries: MenuItemConstructorOptions[] =
    Array.isArray(state.recent) && state.recent.length > 0
      ? state.recent.slice(0, 12).map<MenuItemConstructorOptions>((entry) => ({
          label: `${entry.kind === "workspace" ? "工作区 · " : ""}${String(entry.name).replace(/&/g, "&&")}`,
          toolTip: entry.path,
          click: () => send("recent", entry.path, entry.kind)
        }))
      : [{ label: "暂无最近记录", enabled: false }]

  return [
    ...(process.platform === "darwin" ? [applicationMenu] : []),
    {
      label: "文件",
      submenu: [
        { id: "file-new", label: "新建文档", accelerator: "CommandOrControl+N", enabled: state.canCreate === true, click: () => send("new") },
        { label: "打开文件…", accelerator: "CommandOrControl+O", click: () => send("open") },
        { label: "打开工作区…", accelerator: "CommandOrControl+Shift+O", click: () => send("workspace") },
        { id: "file-recent", label: "最近打开", submenu: recentEntries },
        { type: "separator" },
        { id: "file-save", label: "保存", accelerator: "CommandOrControl+S", enabled: state.canSave === true, click: () => send("save") },
        { id: "file-save-as", label: "另存为…", accelerator: "CommandOrControl+Shift+S", enabled: state.canSave === true, click: () => send("save-as") },
        {
          id: "file-export",
          label: "导出",
          enabled: state.canExport === true,
          submenu: [
            { label: "Markdown…", click: () => send("export-markdown") },
            { label: "PDF…", click: () => send("export-pdf") }
          ]
        },
        { type: "separator" },
        { id: "file-close-tab", label: "关闭当前标签页", accelerator: "CommandOrControl+W", enabled: state.hasDocument === true, click: () => send("close-tab") },
        { label: "关闭窗口", role: "close", accelerator: "CommandOrControl+Shift+W" },
        ...(process.platform === "darwin" ? [] : [{ type: "separator" as const }, { label: "退出 Vessel", role: "quit" as const }])
      ]
    },
    {
      label: "编辑",
      submenu: [
        { label: "撤销", role: "undo" },
        { label: "重做", role: "redo" },
        { type: "separator" },
        { label: "剪切", role: "cut" },
        { label: "复制", role: "copy" },
        { label: "粘贴", role: "paste" },
        { label: "粘贴并匹配样式", role: "pasteAndMatchStyle" },
        { type: "separator" },
        { label: "全选", role: "selectAll" }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { type: "separator" },
        { label: "实际大小", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { type: "separator" },
        { label: "切换全屏", role: "togglefullscreen" },
        { type: "separator" },
        { label: "开发者工具", role: "toggleDevTools" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        { label: "缩放窗口", role: "zoom" },
        ...(process.platform === "darwin" ? [{ type: "separator" as const }, { label: "前置全部窗口", role: "front" as const }] : [])
      ]
    },
    {
      label: "帮助",
      role: "help",
      submenu: [{ label: "关于 Vessel", click: () => app.showAboutPanel() }]
    }
  ]
}

/** Installs Vessel's native application menu while preserving standard edit and window actions. */
export function installApplicationMenu(getWindow: () => BrowserWindow | undefined) {
  const send = (command: FileMenuCommand | "recent", path?: string, kind?: "file" | "workspace") => {
    const window = BrowserWindow.getFocusedWindow() ?? getWindow()
    if (window && !window.isDestroyed()) window.webContents.send("file-menu:command", command, path, kind)
  }
  installFileMenuDialog()
  app.setAboutPanelOptions({ applicationName: "Vessel" })

  const menu = Menu.buildFromTemplate(buildMenuTemplate({}, send, getWindow))
  Menu.setApplicationMenu(menu)

  let lastState = ""
  ipcMain.on("file-menu:state", (event, state: FileMenuState) => {
    const focused = BrowserWindow.getFocusedWindow() ?? getWindow()
    if (!focused || focused.webContents !== event.sender || !state) return
    const fingerprint = JSON.stringify(state)
    if (fingerprint === lastState) return
    lastState = fingerprint

    for (const [id, enabled] of Object.entries({
      "file-new": state.canCreate,
      "file-save": state.canSave,
      "file-save-as": state.canSave,
      "file-export": state.canExport,
      "file-close-tab": state.hasDocument
    })) {
      const item = menu.getMenuItemById(id)
      if (item) item.enabled = enabled === true
    }

    const recent = menu.getMenuItemById("file-recent")
    if (recent?.submenu && Array.isArray(state.recent)) {
      const entries: MenuItemConstructorOptions[] = state.recent.slice(0, 12).map((entry) => ({
        label: `${entry.kind === "workspace" ? "工作区 · " : ""}${String(entry.name).replace(/&/g, "&&")}`,
        toolTip: entry.path,
        click: () => send("recent", entry.path, entry.kind)
      }))
      if (!entries.length) entries.push({ label: "暂无最近记录", enabled: false })
      if (typeof (recent.submenu as any).clear === "function") {
        ;(recent.submenu as any).clear()
        for (const entry of entries) (recent.submenu as any).append(new MenuItem(entry))
      } else {
        const updated = Menu.buildFromTemplate(buildMenuTemplate(state, send, getWindow))
        Menu.setApplicationMenu(updated)
      }
    }
  })
}
