import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, writeFile, readFile, rm, stat, utimes, mkdir, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"
import { syncFiles, collectFiles, SyncError, DEFAULT_CONFLICT_STRATEGY, type StorageAdapter, type RemoteFile } from "#vessel-sync/index"
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

/** Performs the fixture operation. */
async function fixture(count = 1) {
  const root = await mkdtemp(join(tmpdir(), "vessel-sync-package-"))
  roots.push(root)
  const files = await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const source = join(root, `${i}.md`)
      await writeFile(source, `file ${i}`)
      return { path: `${i}.md`, source }
    })
  )
  const objects = new Map<string, RemoteFile & { content: Buffer }>()
  const storage: StorageAdapter = {
    id: "test-store",
    head: vi.fn(async (key) => objects.get(key)),
    upload: vi.fn(async (key, source, options) => {
      objects.set(key, { digest: options.digest, etag: '"etag"', content: await readFile(source) })
    })
  }
  return { root, files, objects, storage, options: { stateDirectory: join(root, "state"), files, storage } }
}
it("bounds concurrency and preserves every receipt when completion order differs", async () => {
  const f = await fixture(16)
  let active = 0,
    maximum = 0
  const original = f.storage.head
  f.storage.head = async (key) => {
    active++
    maximum = Math.max(maximum, active)
    await delay((Number(key.split(".")[0]) % 3) + 2)
    active--
    return original(key)
  }
  const progress = vi.fn()
  expect(await syncFiles({ ...f.options, concurrency: 4, checkpointEvery: 3, onProgress: progress })).toMatchObject({ changed: 16, hashed: 16, checked: 16 })
  expect(maximum).toBe(4)
  expect(progress.mock.calls.filter(([value]) => value.phase === "transferring" && value.completed > 0 && !value.active)).toHaveLength(16)
  expect(progress.mock.calls.at(-1)![0]).toMatchObject({ completed: 16, total: 16, uploaded: 16 })
  expect(Object.keys(JSON.parse(await readFile(join(f.root, "state/backup-files-index.json"), "utf8")).files)).toHaveLength(16)
})
it("reuses hashes, still checks the remote, and detects content changes with restored mtime", async () => {
  const f = await fixture()
  await syncFiles(f.options)
  expect(await syncFiles(f.options)).toMatchObject({ hashed: 0, cached: 1, changed: 0, checked: 1 })
  const before = await stat(f.files[0].source)
  await writeFile(f.files[0].source, "edit 0")
  await utimes(f.files[0].source, before.atime, before.mtime)
  expect(await syncFiles(f.options)).toMatchObject({ hashed: 1, cached: 0, changed: 1 })
  expect(await syncFiles({ ...f.options, verification: "content" })).toMatchObject({ hashed: 1, changed: 0 })
  f.objects.delete("0.md")
  expect(await syncFiles(f.options)).toMatchObject({ cached: 1, changed: 1 })
})
it("keeps remote edits and caches repeatable local conflict copies separately from the baseline", async () => {
  const f = await fixture(2)
  f.objects.set("0.md", { digest: null, etag: '"remote"', content: Buffer.from("external") })
  expect(await syncFiles({ ...f.options, conflictStrategy: "keep-both" })).toMatchObject({ changed: 2, conflicts: ["0.md"] })
  const key = [...f.objects.keys()].find((key) => key.startsWith(".vessel/conflicts/"))!
  expect(key).toMatch(/0\.conflict-[a-f0-9]{64}\.md$/)
  expect(f.objects.get(key)!.content.toString()).toBe("file 0")
  expect(f.objects.get("0.md")!.content.toString()).toBe("external")
  expect(await syncFiles({ ...f.options, conflictStrategy: "keep-both" })).toMatchObject({ changed: 0, cached: 2, conflicts: ["0.md"] })
  expect(JSON.parse(await readFile(join(f.root, "state/backup-files-index.json"), "utf8")).files["0.md"]).toBeUndefined()
})
it("defaults conflictStrategy to DEFAULT_CONFLICT_STRATEGY (keep-newer) and avoids conflict files", async () => {
  expect(DEFAULT_CONFLICT_STRATEGY).toBe("keep-newer")
  const f = await fixture(1)
  f.objects.set("0.md", { digest: null, etag: '"remote"', modifiedMs: 0, content: Buffer.from("older remote") })
  const result = await syncFiles(f.options)
  expect(result.changed).toBe(1)
  expect([...f.objects.keys()].some((key) => key.includes(".conflict"))).toBe(false)
  expect(f.objects.get("0.md")!.content.toString()).toBe("file 0")
})
it("settles in-flight work and checkpoints successes before reporting a failure", async () => {
  const f = await fixture(4),
    original = f.storage.upload
  f.storage.upload = async (key, source, input) => {
    if (key === "0.md") {
      await delay(2)
      throw new Error("offline")
    }
    await delay(10)
    await original(key, source, input)
  }
  await expect(syncFiles({ ...f.options, concurrency: 2 })).rejects.toMatchObject({ code: "SYNC_FAILED", details: { result: { changed: 1 } } })
  const saved = JSON.parse(await readFile(join(f.root, "state/backup-files-index.json"), "utf8"))
  expect(Object.keys(saved.files)).toEqual(["1.md"])
  f.storage.upload = original
  expect(await syncFiles(f.options)).toMatchObject({ changed: 3, cached: 1 })
})
it("prevents same-index overlap and flushes successes when cancelled", async () => {
  const f = await fixture(3),
    controller = new AbortController()
  let release!: () => void, ready!: () => void
  const entered = new Promise<void>((resolve) => {
    ready = resolve
  })
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  f.storage.head = async () => {
    ready()
    await blocked
    return undefined
  }
  const running = syncFiles({ ...f.options, signal: controller.signal, concurrency: 1 })
  await entered
  await expect(syncFiles(f.options)).rejects.toMatchObject({ code: "STATE_BUSY" })
  controller.abort(new Error("cancelled"))
  release()
  await expect(running).rejects.toThrow("cancelled")
  expect(f.storage.upload).not.toHaveBeenCalled()
  f.storage.head = async () => undefined
  expect(await syncFiles(f.options)).toMatchObject({ changed: 3 })
})
it("migrates legacy receipts and separates remote prefixes", async () => {
  const f = await fixture()
  const digest = createHash("sha256").update("old local").digest("hex")
  await mkdir(f.options.stateDirectory)
  await writeFile(join(f.options.stateDirectory, "backup-files-index.json"), JSON.stringify({ target: createHash("sha256").update(f.storage.id).digest("hex"), files: { "0.md": { size: 9, digest } } }))
  f.objects.set("0.md", { digest, etag: '"previous"', content: Buffer.from("old local") })
  expect(await syncFiles(f.options)).toMatchObject({ changed: 1, conflicts: [] })
  f.objects.set("other/0.md", { digest, etag: '"different"', content: Buffer.from("external") })
  expect(await syncFiles({ ...f.options, prefix: "other" })).toMatchObject({ changed: 1, conflicts: ["0.md"] })
})
it("rejects unsafe keys and retains conditional-overwrite failures", async () => {
  const f = await fixture()
  await expect(syncFiles({ ...f.options, files: [{ ...f.files[0], path: "../outside" }] })).rejects.toMatchObject({ code: "INVALID_PATH" })
  await expect(syncFiles({ ...f.options, indexName: ".." })).rejects.toMatchObject({ code: "INVALID_PATH" })
  await expect(syncFiles({ ...f.options, files: [...f.files, ...f.files] })).rejects.toMatchObject({ code: "INVALID_PATH" })
  await expect(syncFiles({ ...f.options, concurrency: 0 })).rejects.toThrow("concurrency")
  f.storage.upload = async () => {
    throw new SyncError("REMOTE_CONFLICT", "concurrent edit")
  }
  await expect(syncFiles(f.options)).rejects.toMatchObject({ code: "REMOTE_CONFLICT" })
})
it("rejects corrupt receipts before touching the remote and preserves the index", async () => {
  const f = await fixture()
  await mkdir(f.options.stateDirectory)
  const indexPath = join(f.options.stateDirectory, "backup-files-index.json")
  const content = JSON.stringify({ target: "test", files: { "0.md": { size: 6, digest: "invalid" } } })
  await writeFile(indexPath, content)
  await expect(syncFiles(f.options)).rejects.toMatchObject({ code: "INVALID_STATE" })
  expect(f.storage.head).not.toHaveBeenCalled()
  expect(await readFile(indexPath, "utf8")).toBe(content)
})
it("recovers a confirmed dead owner's lock without stealing a live owner's lock", async () => {
  const f = await fixture()
  await mkdir(f.options.stateDirectory)
  const path = join(f.options.stateDirectory, "backup-files-index.json.lock")
  await writeFile(path, JSON.stringify({ pid: process.pid }))
  await expect(syncFiles(f.options)).rejects.toMatchObject({ code: "STATE_BUSY" })
  const probe = vi.spyOn(process, "kill").mockImplementation(() => {
    throw Object.assign(new Error("dead"), { code: "ESRCH" })
  })
  try {
    expect(await syncFiles(f.options)).toMatchObject({ changed: 1 })
    expect(probe).toHaveBeenCalledWith(process.pid, 0)
  } finally {
    probe.mockRestore()
  }
})
it("scans with exclusions and blocks selected files outside the root", async () => {
  const f = await fixture()
  await mkdir(join(f.root, "notes"))
  await mkdir(join(f.root, "node_modules"))
  await writeFile(join(f.root, "notes/a.md"), "a")
  await writeFile(join(f.root, "node_modules/private"), "private")
  await writeFile(join(f.root, ".env"), "secret")
  const outside = await fixture()
  await symlink(outside.files[0].source, join(f.root, "link.md"))
  expect((await collectFiles({ root: f.root })).map((file) => file.path)).toEqual(["0.md", "notes/a.md"])
  await expect(collectFiles({ root: f.root, selected: join(f.root, "link.md") })).rejects.toThrow("当前工作区")
  await expect(collectFiles({ root: f.root, selected: join(f.root, ".env") })).rejects.toThrow("排除规则")
})
