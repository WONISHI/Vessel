import * as fs from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, expect, it, vi } from "vitest"
import { WorkspaceSessionStore } from "../../src/main/modules/welcome/workspace-session-store"

vi.mock("node:fs/promises", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, writeFile: vi.fn(actual.writeFile) }
})
afterEach(() => vi.clearAllMocks())
it("serves latest state from memory and coalesces changes into one durable snapshot", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "vessel-sessions-"))
  const file = join(root, "state", "workspace-sessions.json")
  const store = new WorkspaceSessionStore(file)
  try {
    const write = vi.mocked(fs.writeFile)
    for (let i = 0; i < 100; i++) await store.set("workspace-tabs:test", { files: [{ name: "a.ts", path: "/w/a.ts" }], active: "/w/a.ts", expanded: [`/w/${i}`] })
    expect(write).not.toHaveBeenCalled()
    expect((await store.get("workspace-tabs:test"))?.expanded).toEqual(["/w/99"])
    await store.flush()
    expect(write).toHaveBeenCalledTimes(1)
    expect(store.flush()).toBeNull()
    const restored = new WorkspaceSessionStore(file)
    expect(await restored.get("workspace-tabs:test")).toEqual(await store.get("workspace-tabs:test"))
    const copy = await restored.get("workspace-tabs:test")
    copy!.expanded.push("/w/mutation")
    expect((await restored.get("workspace-tabs:test"))?.expanded).toEqual(["/w/99"])
  } finally { await store.flush(); await fs.rm(root, { recursive: true, force: true }) }
})

it("keeps scopes separate, accepts old tabs without expanded state and rejects invalid data", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "vessel-sessions-"))
  const store = new WorkspaceSessionStore(join(root, "sessions.json"))
  try {
    await store.set("workspace-tabs:test", { files: [], active: "" })
    await store.set("resources-tabs:test", { files: [], active: "", expanded: ["/w/src", "/w/src"] })
    expect((await store.get("workspace-tabs:test"))?.expanded).toEqual([])
    expect((await store.get("resources-tabs:test"))?.expanded).toEqual(["/w/src"])
    await expect(store.set("bad", { files: "bad" })).rejects.toThrow("工作区会话无效")
    await store.flush()
  } finally { await store.flush(); await fs.rm(root, { recursive: true, force: true }) }
})

it("flushes changes arriving during an in-flight disk write without overwriting newer state", async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "vessel-sessions-"))
  const file = join(root, "sessions.json")
  const store = new WorkspaceSessionStore(file)
  const actual = await vi.importActual<typeof import("node:fs/promises")>("node:fs/promises")
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  vi.mocked(fs.writeFile).mockImplementationOnce(async (...args) => { await gate; return actual.writeFile(...args) })
  try {
    await store.set("workspace-tabs:test", { files: [], active: "", expanded: ["/old"] })
    const flushing = store.flush()
    await vi.waitFor(() => expect(fs.writeFile).toHaveBeenCalled())
    await store.set("workspace-tabs:test", { files: [], active: "", expanded: ["/new"] })
    release()
    await flushing
    expect((await new WorkspaceSessionStore(file).get("workspace-tabs:test"))?.expanded).toEqual(["/new"])
    expect(store.flush()).toBeNull()
  } finally { release(); await store.flush(); await fs.rm(root, { recursive: true, force: true }) }
})
