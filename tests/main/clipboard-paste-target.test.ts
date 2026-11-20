import { expect, it, vi } from "vitest"
import { captureClipboardTarget, pasteToClipboardTarget } from "../../src/main/clipboard/paste-target"

const mock = vi.hoisted(() => ({ focused: undefined as any, execute: vi.fn() }))
vi.mock("electron", () => ({ webContents: { getFocusedWebContents: () => mock.focused } }))
vi.mock("node:util", () => ({ promisify: () => mock.execute }))

it("restores the original Vessel guest and pastes into it instead of the clipboard search field", async () => {
  const contents = { isDestroyed: () => false, focus: vi.fn(), paste: vi.fn() }
  mock.focused = contents
  const window = { isDestroyed: () => false, isMinimized: () => false, show: vi.fn(), focus: vi.fn(), webContents: { paste: vi.fn() } }
  const target = await captureClipboardTarget(window as any, "/helper")
  mock.focused = { paste: vi.fn() }
  await pasteToClipboardTarget(target, "/helper")
  expect(window.focus).toHaveBeenCalledOnce()
  expect(contents.focus).toHaveBeenCalledOnce()
  expect(contents.paste).toHaveBeenCalledOnce()
  expect(window.webContents.paste).not.toHaveBeenCalled()
})

it("captures and restores a native target before sending paste and rejects missing targets", async () => {
  mock.execute.mockResolvedValue({ stdout: "12345\n" })
  const target = await captureClipboardTarget(null, "/helper")
  expect(target).toEqual({ kind: "external", id: "12345" })
  await pasteToClipboardTarget(target, "/helper")
  if (process.platform === "darwin") expect(mock.execute).toHaveBeenLastCalledWith("/helper", ["--paste-to", "12345"], { timeout: 5000 })
  await expect(pasteToClipboardTarget(undefined, "/helper")).rejects.toThrow("没有可粘贴的目标")
})
