import { EventEmitter } from "node:events"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: undefined as any, saveDialog: vi.fn() }))
vi.mock("electron", () => ({ session: { fromPartition: () => mocks.session }, dialog: { showSaveDialog: mocks.saveDialog } }))
import { notifyBrowserFileSaved, registerBrowserDownloads } from "../../src/main/browser/browser-downloads"
import { registerBrowserNodeScreenshotSave } from "../../src/main/browser/browser-devtools-screenshot"

let root: string
const hosts: EventEmitter[] = []
beforeAll(async () => { root = await mkdtemp(join(tmpdir(), "vessel-downloads-")) })
afterEach(() => { for (const host of hosts.splice(0)) host.emit("destroyed"); mocks.session?.removeAllListeners() })
afterAll(async () => { await rm(root, { recursive: true, force: true }) })
function host() {
  const value = Object.assign(new EventEmitter(), { isDestroyed: vi.fn(() => false), send: vi.fn() })
  hosts.push(value)
  return value
}

it("notifies only completed downloads from this host's browser guests", async () => {
  mocks.session = new EventEmitter()
  const owner = host()
  const source = { hostWebContents: owner, session: mocks.session }
  registerBrowserDownloads(owner as any)
  const path = join(root, "中文 预览.html")
  await writeFile(path, "<!doctype html>")
  const item = Object.assign(new EventEmitter(), { getSavePath: () => path })
  mocks.session.emit("will-download", {}, item, { ...source, hostWebContents: {} })
  expect(item.listenerCount("done")).toBe(0)
  mocks.session.emit("will-download", {}, item, source)
  expect(owner.send).not.toHaveBeenCalled()
  item.emit("done", {}, "completed")
  await vi.waitFor(() => expect(owner.send).toHaveBeenCalledExactlyOnceWith("browser:file-saved", { name: "中文 预览.html", url: pathToFileURL(path).href, source: "download" }))
})

it.each(["cancelled", "interrupted"])("does not offer a preview after %s downloads", async state => {
  mocks.session = new EventEmitter()
  const owner = host()
  registerBrowserDownloads(owner as any)
  const item = Object.assign(new EventEmitter(), { getSavePath: vi.fn() })
  mocks.session.emit("will-download", {}, item, { hostWebContents: owner, session: mocks.session })
  item.emit("done", {}, state)
  expect(item.getSavePath).not.toHaveBeenCalled()
  expect(owner.send).not.toHaveBeenCalled()
})

it("skips unsupported, missing and directory paths and releases pending listeners on host destruction", async () => {
  mocks.session = new EventEmitter()
  const owner = host()
  registerBrowserDownloads(owner as any)
  await writeFile(join(root, "archive.zip"), "zip")
  for (const path of [join(root, "archive.zip"), join(root, "missing.pdf"), root]) await notifyBrowserFileSaved(owner as any, path, "download")
  expect(owner.send).not.toHaveBeenCalled()
  const item = Object.assign(new EventEmitter(), { getSavePath: () => "unused" })
  mocks.session.emit("will-download", {}, item, { hostWebContents: owner, session: mocks.session })
  owner.emit("destroyed")
  expect(item.listenerCount("done")).toBe(0)
  expect(mocks.session.listenerCount("will-download")).toBe(0)
})

it("writes a saved node screenshot before notifying, and stays silent when cancelled", async () => {
  const owner = host()
  let save: (event: unknown, data: string) => Promise<boolean>
  const frontend = { ipc: { handle: (_name: string, handler: typeof save) => { save = handler } } }
  registerBrowserNodeScreenshotSave(frontend as any, owner as any, () => undefined)
  const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=", "base64")
  mocks.saveDialog.mockResolvedValueOnce({ canceled: true })
  expect(await save!({}, image.toString("base64"))).toBe(false)
  expect(owner.send).not.toHaveBeenCalled()
  const path = join(root, "节点 screenshot.png")
  mocks.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: path })
  expect(await save!({}, image.toString("base64"))).toBe(true)
  expect(await readFile(path)).toEqual(image)
  expect(owner.send).toHaveBeenCalledExactlyOnceWith("browser:file-saved", { name: "节点 screenshot.png", url: pathToFileURL(path).href, source: "save" })
})

it("does not notify or open a save dialog for invalid screenshot data", async () => {
  const owner = host()
  let save: (event: unknown, data: string) => Promise<boolean>
  registerBrowserNodeScreenshotSave({ ipc: { handle: (_name: string, handler: typeof save) => { save = handler } } } as any, owner as any, () => undefined)
  await expect(save!({}, "invalid")).rejects.toThrow("截图数据无效")
  expect(owner.send).not.toHaveBeenCalled()
  expect(mocks.saveDialog).not.toHaveBeenCalled()
})
