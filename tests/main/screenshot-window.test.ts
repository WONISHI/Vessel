import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ windows: [] as any[] }))
vi.mock("@main/screenshot/translate", () => ({ translateScreenshot: vi.fn() }))
vi.mock("@main/settings/settings", () => ({ generalSettings: () => ({}), settingsEvents: { on: vi.fn() } }))
vi.mock("electron", () => ({
  app: {}, clipboard: {}, dialog: {}, globalShortcut: {}, nativeImage: {}, shell: {},
  systemPreferences: { getMediaAccessStatus: () => "not-determined" },
  screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1000, height: 800 }, size: { width: 1000, height: 800 }, scaleFactor: 1 }) },
  desktopCapturer: { getSources: async () => [{ display_id: "1", thumbnail: { isEmpty: () => false, toDataURL: () => "data:image/png;base64,AA" } }] },
  BrowserWindow: class {
    handlers = new Map(); options: any
    webContents = { ipc: { handle: (key: string, fn: Function) => this.handlers.set(key, fn) }, setWindowOpenHandler: vi.fn(), on: vi.fn() }
    setBounds = vi.fn(); setAlwaysOnTop = vi.fn(); setVisibleOnAllWorkspaces = vi.fn(); on = vi.fn()
    show = vi.fn(); focus = vi.fn(); close = vi.fn(); isDestroyed = () => false
    loadFile = vi.fn(async () => {}); loadURL = vi.fn(async () => {})
    constructor(options: any) { this.options = options; mocks.windows.push(this) }
  }
}))
import { startScreenshot } from "@main/screenshot/screenshot"
it("does not transform the macOS process or repeatedly activate the screenshot overlay", async () => {
  await startScreenshot()
  const win = mocks.windows[0]
  expect(win.options.resizable).toBe(false)
  if (process.platform === "darwin") {
    expect(win.options).toMatchObject({ type: "panel", fullscreenable: false, acceptFirstMouse: true })
  }
  expect(win.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  win.handlers.get("shot:ready")()
  win.handlers.get("shot:ready")()
  expect(win.show).toHaveBeenCalledTimes(1)
  expect(win.focus).not.toHaveBeenCalled()
})
