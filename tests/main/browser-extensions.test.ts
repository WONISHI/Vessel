import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ directory: "", selection: "", load: vi.fn(async () => ({ id: "ext-id", name: "Test", version: "1.0" })), remove: vi.fn() }))
vi.mock("electron", () => ({ app: { getPath: () => mocks.directory }, BrowserWindow: { fromWebContents: () => ({}) }, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [mocks.selection] }) }, session: { fromPartition: () => ({ extensions: { loadExtension: mocks.load, removeExtension: mocks.remove } }) } }))
it("installs, persists, disables, re-enables and removes extension records without deleting source", async () => {
  mocks.directory = await mkdtemp(join(tmpdir(), "vessel-extensions-"))
  mocks.selection = mocks.directory
  const manifest = join(mocks.directory, "manifest.json")
  await writeFile(manifest, JSON.stringify({ name: "Test", version: "1.0", manifest_version: 3 }))
  const handlers = new Map<string, (...args: unknown[]) => Promise<unknown>>()
  const { registerBrowserExtensions } = await import("../../src/main/browser-extensions")
  registerBrowserExtensions({ ipc: { handle: (name: string, handler: (...args: unknown[]) => Promise<unknown>) => handlers.set(name, handler) } } as never)
  try {
    const installed = await handlers.get("browser:extensions:install")!() as {key: string}[]
    const key = installed[0].key
    expect(mocks.load).toHaveBeenCalled()
    await handlers.get("browser:extensions:enabled")!(null, key, false)
    expect(JSON.parse(await readFile(join(mocks.directory, "browser-extensions.json"), "utf8"))[0].enabled).toBe(false)
    await handlers.get("browser:extensions:enabled")!(null, key, true)
    expect(mocks.load).toHaveBeenCalledTimes(2)
    await handlers.get("browser:extensions:remove")!(null, key)
    expect(await handlers.get("browser:extensions:list")!()).toEqual([])
    expect(await readFile(manifest, "utf8")).toContain('"Test"')
  } finally { await rm(mocks.directory, { recursive: true, force: true }) }
})
