import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
import { startClipboardHistory } from "../../src/main/clipboard/service"

const mock = vi.hoisted(() => ({ events: [] as string[], handlers: new Map<string, (...args: any[]) => any>(), target: { kind: "external", id: "42" }, paste: vi.fn(), panel: undefined as any }))
vi.mock("../../src/main/clipboard/paste-target", () => ({
  captureClipboardTarget: vi.fn(async () => { mock.events.push("capture-target"); return mock.target }),
  pasteToClipboardTarget: (...args: unknown[]) => { mock.events.push("paste"); return mock.paste(...args) }
}))
vi.mock("../../src/main/clipboard/history", () => ({ ClipboardHistory: class {
  get() { return { kind: "text", text: "saved clipboard text" } }
  list() { return [] }
  count() { return 1 }
  add() { return false }
  close() { /* In-memory fixture. */ }
}, clipboardTextKind: () => "text", MAX_CAPTURE_BYTES: 16_000_000 }))
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events")
  return {
    app: Object.assign(new EventEmitter(), { isPackaged: false }),
    BrowserWindow: class extends EventEmitter {
      static getFocusedWindow() { return null }
      visible = false
      destroyed = false
      webContents = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => mock.handlers.set(name, handler) }, send: vi.fn(), setWindowOpenHandler: vi.fn() })
      constructor() { super(); mock.panel = this }
      isDestroyed() { return this.destroyed }
      isVisible() { return this.visible }
      show() { this.visible = true; mock.events.push("show") }
      showInactive() { this.visible = true; mock.events.push("show-inactive") }
      hide() { this.visible = false; mock.events.push("hide") }
      focus() { mock.events.push("focus") }
      destroy() { this.destroyed = true }
      setBounds() { /* No real desktop window. */ }
      setVisibleOnAllWorkspaces() { /* No real desktop window. */ }
    },
    clipboard: { availableFormats: () => [], readText: () => "", write: vi.fn(() => mock.events.push("write")) },
    globalShortcut: {}, nativeImage: {}, screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }), getDisplayNearestPoint: () => ({ workArea: { x: 0, y: 0, width: 1200, height: 800 } }) }
  }
})

it("writes clipboard content, hides the panel, pastes into the captured target, and respects keep-open/failure", async () => {
  const directory = mkdtempSync(join(tmpdir(), "vessel-clipboard-paste-"))
  const service = startClipboardHistory({ directory, helperPath: "/helper", monitor: false, registerShortcut: false, loadPanel: async () => {} })
  try {
    await service.show()
    expect(mock.events.indexOf("capture-target")).toBeLessThan(mock.events.indexOf("show"))
    mock.events.length = 0
    await service.paste(1)
    expect(mock.events).toEqual(["write", "hide", "paste"])
    expect(mock.paste).toHaveBeenLastCalledWith(mock.target, "/helper")
    expect(mock.panel.visible).toBe(false)
    mock.handlers.get("clipboard:keep-open")!({}, true)
    mock.events.length = 0
    await service.paste(1)
    expect(mock.events).toEqual(["write", "hide", "paste", "show-inactive"])
    mock.paste.mockRejectedValueOnce(new Error("无法恢复原来的输入应用"))
    await expect(service.paste(1)).rejects.toThrow("无法恢复原来的输入应用")
    expect(mock.panel.visible).toBe(true)
    expect(mock.events.slice(-2)).toEqual(["show", "focus"])
  } finally { service.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
