import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ windows: [] as any[], getSources: vi.fn(async () => [{ display_id: "1", thumbnail: { isEmpty: () => false, toDataURL: () => "data:image/png;base64,AA" } }]), permission: vi.fn(() => "not-determined") }))
vi.mock("@main/screenshot/preview-fullscreen", () => ({ fullscreenPreviewWindow: vi.fn(async () => undefined) }))
vi.mock("@main/screenshot/translate", () => ({ translateScreenshot: vi.fn() }))
vi.mock("@main/settings/settings", () => ({ generalSettings: () => ({}), settingsEvents: { on: vi.fn() } }))
vi.mock("electron", () => ({
  app: {}, clipboard: { writeImage: vi.fn() }, dialog: {}, globalShortcut: {},
  nativeImage: { createFromDataURL: () => ({ isEmpty: () => false, getSize: () => ({ width: 320, height: 200 }) }) }, shell: {},
  systemPreferences: { getMediaAccessStatus: mocks.permission },
  screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ id: 1, bounds: { x: 0, y: 0, width: 1000, height: 800 }, size: { width: 1000, height: 800 }, workArea: { x: 0, y: 0, width: 1000, height: 800 }, scaleFactor: 1 }) },
  desktopCapturer: { getSources: mocks.getSources },
  BrowserWindow: class {
    handlers = new Map(); options: any
    webContents = { ipc: { handle: (key: string, fn: Function) => this.handlers.set(key, fn) }, setWindowOpenHandler: vi.fn(), on: vi.fn() }
    setBounds = vi.fn(); setAlwaysOnTop = vi.fn(); setVisibleOnAllWorkspaces = vi.fn(); on = vi.fn()
    showInactive = vi.fn(); show = vi.fn(); focus = vi.fn(); close = vi.fn(); isDestroyed = () => false
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
  await win.handlers.get("shot:finish")({}, "data:image/png;base64,AA", true)
  const pin = mocks.windows[1]
  expect(pin.options).toMatchObject({ resizable: true, hasShadow: true })
  if (process.platform === "darwin") expect(pin.options).toMatchObject({ type: "panel", fullscreenable: false })
  expect(pin.setAlwaysOnTop).toHaveBeenCalledWith(true, "screen-saver")
  expect(pin.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, expect.objectContaining({ visibleOnFullScreen: true }))
  expect(pin.showInactive).toHaveBeenCalledOnce()
  expect(pin.show).not.toHaveBeenCalled()
})
it("previews the real screenshot interface without querying screen permissions or capturing the desktop", async () => {
  vi.resetModules()
  mocks.getSources.mockClear()
  mocks.permission.mockClear()
  const { startScreenshot: preview } = await import("@main/screenshot/screenshot")
  const capturePage = vi.fn(async () => ({ toDataURL: () => "data:image/png;base64,PREVIEW" }))
  await preview({ capturePage } as unknown as Electron.WebContents)
  const win = mocks.windows.at(-1)
  expect(capturePage).toHaveBeenCalledOnce()
  expect(mocks.getSources).not.toHaveBeenCalled()
  expect(mocks.permission).not.toHaveBeenCalled()
  expect(win.handlers.get("shot:data")()).toEqual({ mode: "capture", image: "data:image/png;base64,PREVIEW" })
  win.handlers.get("shot:ready")()
  expect(win.show).toHaveBeenCalledOnce()
})
