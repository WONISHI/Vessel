import { expect, it, vi } from "vitest"
import type { WebContents } from "electron"
vi.mock("node:fs", () => ({ readFileSync: () => Buffer.from("font") }))
const mocks = vi.hoisted(() => {
  const panel = { setBounds: vi.fn(), webContents: { on: vi.fn(), isDestroyed: () => false, setZoomFactor: vi.fn(), insertCSS: vi.fn().mockResolvedValue("css"), removeInsertedCSS: vi.fn(), close: vi.fn() } }
  const host = { ipc: { handle: vi.fn() }, once: vi.fn() }
  const guest = { hostWebContents: host, setDevToolsWebContents: vi.fn(), openDevTools: vi.fn(), once: vi.fn(), removeListener: vi.fn(), closeDevTools: vi.fn(), isDestroyed: () => false }
  const detached = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() }, getContentSize: () => [1000, 600], on: vi.fn(), isDestroyed: () => false, destroy: vi.fn() }
  return { panel, host, guest, detached, window: { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() }, getContentBounds: () => ({ width: 1200, height: 800 }) } }
})
vi.mock("electron", () => ({
  BrowserWindow: class { static fromWebContents() { return mocks.window }; constructor() { return mocks.detached } },
  WebContentsView: class { constructor() { return mocks.panel } },
  webContents: { fromId: (id: number) => id === 1 ? mocks.guest : { hostWebContents: {} } }
}))
import { registerBrowserDevtools } from "../../src/main/browser-devtools"
it("positions only the host's guest console and applies validated font preferences", async () => {
  registerBrowserDevtools(mocks.host as unknown as WebContents)
  const handle = mocks.host.ipc.handle.mock.calls[0][1]
  handle({}, 1, { x: 800, y: 100, width: 400, height: 700 }, { font: "Consolas", size: 16 })
  expect(mocks.panel.setBounds).toHaveBeenCalledWith({ x: 800, y: 100, width: 400, height: 700 })
  expect(mocks.guest.setDevToolsWebContents).toHaveBeenCalledWith(mocks.panel.webContents)
  expect(mocks.panel.webContents.setZoomFactor).toHaveBeenCalledWith(16 / 13)
  expect(mocks.panel.webContents.insertCSS.mock.calls[0][0]).toContain('"Consolas"')
  expect(() => handle({}, 2, { x: 0, y: 0, width: 100, height: 100 })).toThrow()
  expect(() => handle({}, 1, { x: 0, y: 0, width: 100, height: 100 }, { font: "invalid", size: 16 })).toThrow()
  await Promise.resolve()
  handle({}, null)
  expect(mocks.guest.closeDevTools).toHaveBeenCalled()
  handle({}, 1, { x: 0, y: 0, width: 0, height: 0 }, { font: "Plus Jakarta Sans", size: 13, detached: true })
  expect(mocks.detached.contentView.addChildView).toHaveBeenCalledWith(mocks.panel)
  expect(mocks.panel.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 1000, height: 600 })
  handle({}, null)
  expect(mocks.detached.destroy).toHaveBeenCalled()
})
