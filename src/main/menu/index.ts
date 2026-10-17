import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron"

/** Installs Vessel's native application menu while preserving standard edit and window actions. */
export function installApplicationMenu(getWindow: () => BrowserWindow | undefined) {
  const applicationMenu: MenuItemConstructorOptions = {
    label: "vessel",
    submenu: [
      {
        label: "关于vessel",
        /** Displays Vessel's native application information. */
        click: () => app.showAboutPanel()
      },
      { type: "separator" },
      {
        label: "设置",
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
      { label: "退出vessel", role: "quit" }
    ]
  }
  app.setAboutPanelOptions({ applicationName: "Vessel" })
  Menu.setApplicationMenu(Menu.buildFromTemplate([...(process.platform === "darwin" ? [applicationMenu] : []), { label: "文件", role: "fileMenu" }, { label: "编辑", role: "editMenu" }, { label: "视图", role: "viewMenu" }, { label: "窗口", role: "windowMenu" }, { role: "help" }]))
}
