import { expect, it, vi } from "vitest"
import type { MenuItemConstructorOptions } from "electron"
const mocks = vi.hoisted(() => ({ menu: null as unknown, on: vi.fn(), handle: vi.fn(), send: vi.fn(), contents: {} }))
vi.mock("electron", () => {
  const window = { isDestroyed: () => false, webContents: mocks.contents }
  return {
    app: { setAboutPanelOptions: vi.fn(), showAboutPanel: vi.fn() },
    BrowserWindow: { getFocusedWindow: () => window },
    ipcMain: { on: mocks.on, handle: mocks.handle },
    dialog: {},
    MenuItem: class { constructor(options: MenuItemConstructorOptions) { Object.assign(this, options) } },
    Menu: {
      buildFromTemplate: (items: MenuItemConstructorOptions[]) => {
        const prepare = (entries: MenuItemConstructorOptions[]) => { for (const item of entries) {
          if (Array.isArray(item.submenu)) {
            const children = item.submenu
            prepare(children)
            const submenu = { items: children, clear() { this.items = [] }, append(entry: MenuItemConstructorOptions) { this.items.push(entry) } }
            Object.defineProperty(item, "submenu", { value: submenu, writable: false })
          }
        }
        }
        prepare(items)
        const menu = {
          items,
          getMenuItemById: (id: string): MenuItemConstructorOptions | undefined => {
            const find = (entries: MenuItemConstructorOptions[]): MenuItemConstructorOptions | undefined => {
              for (const entry of entries) {
                if (entry.id === id) return entry
                if (entry.submenu && "items" in entry.submenu) { const result = find(entry.submenu.items as unknown as MenuItemConstructorOptions[]); if (result) return result }
              }
              return undefined
            }
            return find(items)
          }
        }
        return menu
      },
      setApplicationMenu: (menu: unknown) => { mocks.menu = menu }
    }
  }
})
import { installApplicationMenu } from "@main/menu"

it("creates the complete File menu and updates document capabilities", () => {
  installApplicationMenu(() => undefined)
  const menu = mocks.menu as { items: MenuItemConstructorOptions[]; getMenuItemById(id: string): MenuItemConstructorOptions }
  const file = menu.items.find((item) => item.label === "文件")!
  const entries = (file.submenu as unknown as { items: MenuItemConstructorOptions[] }).items
  expect(entries.filter((entry) => entry.label).map((entry) => entry.label)).toEqual(expect.arrayContaining(["新建文档", "打开文件…", "打开工作区…", "最近打开", "保存", "另存为…", "导出", "关闭当前标签页", "关闭窗口"]))
  expect(menu.getMenuItemById("file-save").enabled).toBe(false)
  const receive = mocks.on.mock.calls.find(([name]) => name === "file-menu:state")![1]
  receive({ sender: mocks.contents }, { canCreate: true, hasDocument: true, canSave: true, canExport: true, recent: [] })
  expect(menu.getMenuItemById("file-save").enabled).toBe(true)
  expect(menu.getMenuItemById("file-export").enabled).toBe(true)
  const recent = menu.getMenuItemById("file-recent").submenu as unknown as { items: MenuItemConstructorOptions[] }
  expect(Object.getOwnPropertyDescriptor(menu.getMenuItemById("file-recent"), "submenu")?.writable).toBe(false)
  receive({ sender: mocks.contents }, { canCreate: true, hasDocument: true, canSave: true, canExport: true, recent: [{ name: "example.md", path: "/notes/example.md", kind: "file" }] })
  expect(recent.items.map((item) => item.label)).toEqual(["example.md"])
  receive({ sender: mocks.contents }, { canCreate: true, hasDocument: false, canSave: false, canExport: false, recent: [] })
  expect(menu.getMenuItemById("file-close-tab").enabled).toBe(false)
  expect(recent.items.map((item) => item.label)).toEqual(["暂无最近记录"])
})
