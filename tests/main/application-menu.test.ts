import { expect, it, vi } from "vitest"
import { installApplicationMenu } from "@main/menu"
const mocks = vi.hoisted(() => ({ build: vi.fn((template) => template), set: vi.fn(), about: vi.fn(), options: vi.fn(), on: vi.fn(), handle: vi.fn() }))
vi.mock("electron", () => ({
  app: { showAboutPanel: mocks.about, setAboutPanelOptions: mocks.options },
  BrowserWindow: {},
  ipcMain: { on: mocks.on, handle: mocks.handle },
  MenuItem: class { constructor(opts: unknown) { Object.assign(this, opts) } },
  Menu: { buildFromTemplate: mocks.build, setApplicationMenu: mocks.set }
}))

it.runIf(process.platform === "darwin")("names the macOS menu and opens settings in the main window", () => {
  const window = { isDestroyed: () => false, isMinimized: () => true, restore: vi.fn(), show: vi.fn(), focus: vi.fn(), webContents: { send: vi.fn() } }
  installApplicationMenu(() => window as any)
  const menu = mocks.build.mock.calls[0][0][0]
  expect(menu.label).toBe("Vessel")
  expect(menu.submenu.some((item: any) => ["hide", "hideOthers", "unhide"].includes(item.role))).toBe(true)
  expect(mocks.build.mock.calls[0][0].slice(1, 5).map((item: any) => item.label)).toEqual(["文件", "编辑", "视图", "窗口"])
  expect(menu.submenu.find((item: any) => item.role === "quit").label).toBe("退出 Vessel")
  menu.submenu.find((item: any) => item.label === "关于 Vessel").click()
  expect(mocks.about).toHaveBeenCalled()
  menu.submenu.find((item: any) => item.label === "设置…").click()
  expect(window.restore).toHaveBeenCalled()
  expect(window.webContents.send).toHaveBeenCalledWith("app:open-settings")
})
