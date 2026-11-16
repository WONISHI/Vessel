import { EventEmitter } from "node:events"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { clipboardHelperPath } from "../../src/main/clipboard/native-helper"

const mock = vi.hoisted(() => ({ spawn: vi.fn(), formats: vi.fn(() => []), close: vi.fn(), register: vi.fn(() => true), unregister: vi.fn() }))
vi.mock("node:child_process", () => ({ spawn: mock.spawn, execFile: vi.fn() }))
vi.mock("node:fs", async (original) => ({ ...await original<typeof import("node:fs")>(), existsSync: () => true }))
vi.mock("electron", async () => {
  const { EventEmitter } = await import("node:events")
  return { app: Object.assign(new EventEmitter(), { isPackaged: true }), BrowserWindow: {}, clipboard: { availableFormats: mock.formats }, globalShortcut: { register: mock.register, unregister: mock.unregister }, nativeImage: {}, screen: {} }
})
vi.mock("../../src/main/clipboard/history", () => ({ ClipboardHistory: class {
  list() { return [] }
  count() { return 0 }
  close = mock.close
}, clipboardTextKind: vi.fn(), MAX_CAPTURE_BYTES: 16_000_000 }))

let dispose: (() => void) | undefined
const directories: string[] = []
afterEach(() => { dispose?.(); dispose = undefined; vi.useRealTimers(); directories.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true })) })

it("resolves the physical executable in a packaged ASAR without changing development paths", () => {
  expect(clipboardHelperPath("/Applications/Vessel.app/Contents/Resources/app.asar/out/main", true)).toBe("/Applications/Vessel.app/Contents/Resources/app.asar.unpacked/out/main/vessel-clipboard")
  expect(clipboardHelperPath("/project/out/main", false)).toBe("/project/out/main/vessel-clipboard")
  expect(clipboardHelperPath("/path/app.asar.unpacked/out/main", true)).toBe("/path/app.asar.unpacked/out/main/vessel-clipboard")
})

it.each(["synchronous", "asynchronous"])("falls back to polling after a %s native spawn failure and releases resources", async (failure) => {
  vi.useFakeTimers()
  vi.spyOn(console, "warn").mockImplementation(() => { /* Expected native startup failure. */ })
  const child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), kill: vi.fn() })
  mock.spawn.mockImplementation(() => { if (failure === "synchronous") throw Object.assign(new Error("spawn ENOTDIR"), { code: "ENOTDIR" }); return child })
  const directory = mkdtempSync(join(tmpdir(), "vessel-clipboard-startup-"))
  directories.push(directory)
  const { startClipboardHistory } = await import("../../src/main/clipboard/service")
  const service = startClipboardHistory({ directory, helperPath: "/test/vessel-clipboard" })
  dispose = service.dispose
  if (failure === "asynchronous") child.emit("error", new Error("spawn EACCES"))
  expect(service.state().total).toBe(0)
  expect(mock.formats).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(2000)
  expect(mock.formats).toHaveBeenCalledTimes(3)
  service.dispose()
  vi.advanceTimersByTime(2000)
  expect(mock.formats).toHaveBeenCalledTimes(3)
  expect(mock.close).toHaveBeenCalledTimes(1)
  expect(mock.unregister).toHaveBeenCalledTimes(1)
})
