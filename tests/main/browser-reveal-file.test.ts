import { EventEmitter } from "node:events"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { pathToFileURL } from "node:url"
import { afterAll, beforeAll, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ target: undefined as any, session: { on: vi.fn(), removeListener: vi.fn() }, reveal: vi.fn(), saveDialog: vi.fn() }))
vi.mock("electron", () => ({
  app: { getPath: () => tmpdir(), once: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] }, dialog: { showSaveDialog: mock.saveDialog },
  session: { fromPartition: () => mock.session },
  webContents: { fromId: () => mock.target },
  shell: { showItemInFolder: mock.reveal }
}))
vi.mock("@main/browser/browser-history", () => ({ BrowserHistory: class { prune = vi.fn(); close = vi.fn() } }))
import { registerBrowserTools } from "../../src/main/browser/browser-tools"

let directory: string
let pageAction: (event: unknown, id: number, action: string) => Promise<unknown>
let host: EventEmitter & { send: ReturnType<typeof vi.fn> }
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "vessel-reveal-"))
  host = Object.assign(new EventEmitter(), { send: vi.fn(), isDestroyed: () => false, ipc: { handle: (name: string, handler: typeof pageAction) => { if (name === "browser:page-action") pageAction = handler } } })
  registerBrowserTools(host as any)
})
afterAll(async () => { await rm(directory, { recursive: true, force: true }) })
const guest = (url: string) => { mock.target = { hostWebContents: host, session: mock.session, getURL: () => url } }

it("decodes Chinese, spaces, percent signs and URL fragments using the guest's current URL", async () => {
  const file = join(directory, "中文 100% #预览.html")
  await writeFile(file, "<!doctype html>")
  guest(pathToFileURL(file).href + "?preview=1#section")
  await pageAction({}, 7, "reveal")
  expect(mock.reveal).toHaveBeenCalledExactlyOnceWith(file)
})

it.each(["https://example.com/a.html", "http://localhost/a.html", "about:blank"])("rejects revealing non-file URLs: %s", async url => {
  guest(url)
  await expect(pageAction({}, 7, "reveal")).rejects.toThrow("不是本地资源")
  expect(mock.reveal).not.toHaveBeenCalled()
})

it("reports a missing local file instead of silently opening a file manager", async () => {
  guest(pathToFileURL(join(directory, "missing.html")).href)
  await expect(pageAction({}, 7, "reveal")).rejects.toThrow("不存在或无法访问")
  expect(mock.reveal).not.toHaveBeenCalled()
})

it("rejects guests belonging to another host", async () => {
  guest(pathToFileURL(join(directory, "preview.html")).href)
  mock.target.hostWebContents = {}
  await expect(pageAction({}, 7, "reveal")).rejects.toThrow("浏览器页面无效")
  expect(mock.reveal).not.toHaveBeenCalled()
})

it("notifies after a webpage save finishes, and not after cancelling or a failed write", async () => {
  guest("https://example.com")
  const path = join(directory, "saved.html")
  mock.target.isDestroyed = () => false
  mock.target.savePage = vi.fn(async () => { await writeFile(path, "<!doctype html>") })
  mock.saveDialog.mockResolvedValueOnce({ canceled: true })
  await pageAction({}, 7, "save")
  expect(mock.target.savePage).not.toHaveBeenCalled()
  expect(host.send).not.toHaveBeenCalled()
  mock.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: path })
  await pageAction({}, 7, "save")
  expect(host.send).toHaveBeenCalledExactlyOnceWith("browser:file-saved", { name: "saved.html", url: pathToFileURL(path).href, source: "save" })
  host.send.mockClear()
  mock.target.savePage.mockRejectedValueOnce(new Error("write failed"))
  mock.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: path })
  await expect(pageAction({}, 7, "save")).rejects.toThrow("write failed")
  expect(host.send).not.toHaveBeenCalled()
})
