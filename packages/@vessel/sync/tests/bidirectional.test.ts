import { afterEach, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { collectFiles, syncFiles, SyncError, excludedBackupName, createSyncExcludeFilter, type StorageAdapter, type RemoteFile } from "#vessel-sync/index"
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

/** Performs the digest operation. */
const digest = (content: string | Buffer) => createHash("sha256").update(content).digest("hex")

/** Performs the fixture operation. */
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "vessel-two-way-"))
  roots.push(root)
  const a = join(root, "a"),
    b = join(root, "b")
  await mkdir(a)
  await mkdir(b)
  let version = 0
  const objects = new Map<string, RemoteFile & { content: Buffer }>()

  /** Performs the put operation. */
  const put = (path: string, content: string | Buffer) => {
    const data = Buffer.from(content),
      entry = { digest: digest(data), etag: `"${++version}"`, size: data.length, modifiedMs: Date.now(), content: data }
    objects.set(path, entry)
    return entry
  }
  const storage: StorageAdapter = {
    id: "shared-store",
    list: vi.fn(async (prefix) => new Map([...objects].filter(([key]) => key.startsWith(prefix)).map(([key, entry]) => [key, { ...entry, content: undefined, digest: null }]))),
    head: vi.fn(async (key) => objects.get(key)),
    upload: vi.fn(async (key, source, options) => {
      const current = objects.get(key)
      if (current ? current.etag !== options.etag : !!options.etag) throw new SyncError("REMOTE_CONFLICT", "remote changed")
      return put(key, await readFile(source))
    }),
    download: vi.fn(async (key, destination, options) => {
      const entry = objects.get(key)
      if (!entry || entry.etag !== options.etag) throw new SyncError("REMOTE_CONFLICT", "remote changed")
      await writeFile(destination, entry.content)
      return entry
    }),
    remove: vi.fn(async (key, options) => {
      if (objects.get(key)?.etag !== options.etag) throw new SyncError("REMOTE_CONFLICT", "remote changed")
      objects.delete(key)
    })
  }

  /** Runs run. */
  const run = async (local = a, extra: Partial<Parameters<typeof syncFiles>[0]> = {}) => syncFiles({ root: local, files: await collectFiles({ root: local }), stateDirectory: join(root, local === a ? "state-a" : "state-b"), storage, direction: "bidirectional", exclude: excludedBackupName, ...extra })
  return { root, a, b, put, run, storage, objects }
}
it("syncs edits between two devices and needs no per-file HEAD on unchanged warm runs", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "device a")
  expect(await f.run()).toMatchObject({ changed: 1, downloaded: 0, checked: 0 })
  expect(await f.run(f.b)).toMatchObject({ changed: 0, downloaded: 1 })
  expect(await readFile(join(f.b, "note.md"), "utf8")).toBe("device a")
  vi.mocked(f.storage.head).mockClear()
  expect(await f.run()).toMatchObject({ changed: 0, downloaded: 0, checked: 0, cached: 1 })
  expect(f.storage.head).not.toHaveBeenCalled()
  await writeFile(join(f.b, "note.md"), "device b edited")
  expect(await f.run(f.b)).toMatchObject({ changed: 1 })
  expect(await f.run()).toMatchObject({ downloaded: 1, conflicts: [] })
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("device b edited")
})
it("keeps both concurrent edits locally and remotely without repeating conflicts", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "base")
  await f.run()
  await f.run(f.b)
  await writeFile(join(f.a, "note.md"), "a modified")
  await writeFile(join(f.b, "note.md"), "b modified")
  await f.run(f.b)
  expect(await f.run()).toMatchObject({ conflicts: ["note.md"], changed: 1, downloaded: 1 })
  const copy = `note.conflict-local-${digest("a modified")}.md`
  expect(await readFile(join(f.a, copy), "utf8")).toBe("a modified")
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("b modified")
  expect(f.objects.get(copy)?.content.toString()).toBe("a modified")
  expect(await f.run()).toMatchObject({ changed: 0, downloaded: 0, conflicts: [] })
  await f.run(f.b)
  expect(await readFile(join(f.b, copy), "utf8")).toBe("a modified")
})
it("previews deletes without writes, protects mass deletion, and propagates accepted deletes", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "base")
  await f.run()
  await f.run(f.b)
  await rm(join(f.a, "note.md"))
  const preview = await f.run(f.a, { propagateDeletes: true, dryRun: true })
  expect(preview.plan).toContainEqual({ path: "note.md", action: "delete-remote", reason: "本地已删除，远端未变化" })
  expect(f.objects.has("note.md")).toBe(true)
  await expect(f.run(f.a, { propagateDeletes: true })).rejects.toMatchObject({ code: "DELETE_PROTECTION" })
  expect(await f.run(f.a, { propagateDeletes: true, deleteThresholdPercent: 100 })).toMatchObject({ deleted: 1 })
  expect(await f.run(f.b, { propagateDeletes: true, deleteThresholdPercent: 100 })).toMatchObject({ deleted: 1 })
  await expect(readFile(join(f.b, "note.md"))).rejects.toMatchObject({ code: "ENOENT" })
  expect(
    await collectFiles({
      root: join(f.b, ".vessel/trash"),

      /** Performs the exclude operation. */
      exclude: () => false
    })
  ).toHaveLength(1)
})
it("preserves a remote edit racing a local deletion and keeps excluded paths out of the plan", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "base")
  await f.run()
  await rm(join(f.a, "note.md"))
  f.put("note.md", "external edit")
  f.put(".env", "secret")
  f.put(".vessel/conflicts/hidden.md", "internal")
  expect(await f.run(f.a, { propagateDeletes: true })).toMatchObject({ downloaded: 1, deleted: 0 })
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("external edit")
  await expect(readFile(join(f.a, ".env"))).rejects.toMatchObject({ code: "ENOENT" })
})
it("blocks local edits during downloads and symlink escapes", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "base")
  await f.run()
  f.put("note.md", "remote update")
  const download = f.storage.download!
  f.storage.download = async (...args) => {
    const remote = await download(...args)
    await writeFile(join(f.a, "note.md"), "edited during transfer")
    return remote
  }
  expect(await f.run()).toMatchObject({ skipped: ["note.md"] })
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("edited during transfer")
  f.storage.download = download
  f.objects.clear()
  f.put("escape/outside.md", "outside")
  await symlink(f.b, join(f.a, "escape"))
  await expect(f.run()).rejects.toMatchObject({ code: "INVALID_PATH" })
  await expect(readFile(join(f.b, "outside.md"))).rejects.toMatchObject({ code: "ENOENT" })
})
it("supports push/pull scopes, size limits and conflict warnings without mutation", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "local.md"), "local")
  f.put("remote.md", "remote")
  expect(await f.run(f.a, { direction: "pull" })).toMatchObject({ changed: 0, downloaded: 1 })
  expect(f.objects.has("local.md")).toBe(false)
  f.put("ignored.md", "remote outside selection")
  expect(await f.run(f.a, { paths: ["local.md"], direction: "push" })).toMatchObject({ changed: 1, downloaded: 0 })
  await expect(readFile(join(f.a, "ignored.md"))).rejects.toMatchObject({ code: "ENOENT" })
  f.put("large.md", "large content")
  expect(await f.run(f.a, { maxFileSize: 5, dryRun: true })).toMatchObject({ skipped: expect.arrayContaining(["large.md"]) })
  await writeFile(join(f.a, "local.md"), "another local version")
  f.put("local.md", "another remote version")
  await expect(f.run(f.a, { conflictStrategy: "error" })).rejects.toMatchObject({ code: "REMOTE_CONFLICT" })
  expect(await readFile(join(f.a, "local.md"), "utf8")).toBe("another local version")
})
it("falls back to HEAD for push-only list permissions failures, without treating denied lists as empty", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "local")
  f.storage.list = async () => {
    throw new SyncError("S3_REQUEST", "denied", { status: 403 })
  }
  expect(await f.run(f.a, { direction: "push" })).toMatchObject({ changed: 1, checked: 1 })
  await expect(f.run()).rejects.toMatchObject({ code: "S3_REQUEST" })
})
it("adopts an existing vault without SHA metadata using matching single-part ETags", async () => {
  const f = await fixture()
  Object.assign(f.storage, { etagContentHash: "md5" })
  for (let i = 0; i < 128; i++) {
    const path = `${i}.webp`,
      content = `existing image ${i}`
    await writeFile(join(f.a, path), content)
    const entry = f.put(path, content)
    entry.etag = `"${createHash("md5").update(content).digest("hex")}"`
  }
  expect(await f.run()).toMatchObject({ changed: 0, downloaded: 0, downloadSize: 0, checked: 0, conflicts: [] })
  expect(f.storage.upload).not.toHaveBeenCalled()
  expect(f.storage.download).not.toHaveBeenCalled()
  expect(f.storage.head).not.toHaveBeenCalled()
  expect(await f.run()).toMatchObject({ hashed: 0, cached: 128, changed: 0, downloaded: 0 })
})
it("verifies unknown multipart content instead of manufacturing a conflict", async () => {
  const f = await fixture(),
    content = "same contents without metadata"
  await writeFile(join(f.a, "note.md"), content)
  const entry = f.put("note.md", content)
  entry.etag = '"opaque-multipart-2"'
  f.storage.head = vi.fn(async (key) => ({ ...f.objects.get(key)!, digest: null }))
  const download = f.storage.download!
  f.storage.download = vi.fn(async (...args) => ({ ...(await download(...args)), digest: null }))
  expect(await f.run()).toMatchObject({ changed: 0, downloaded: 0, verified: 1, conflicts: [] })
  expect(f.storage.download).toHaveBeenCalledTimes(1)
  expect(f.storage.upload).not.toHaveBeenCalled()
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe(content)
})
it("reuses verified bytes for genuine unknown-content conflicts instead of downloading twice", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "local bytes")
  f.put("note.md", "remote bytes")
  f.storage.head = vi.fn(async (key) => (f.objects.has(key) ? { ...f.objects.get(key)!, digest: null } : undefined))
  const download = f.storage.download!
  f.storage.download = vi.fn(async (...args) => ({ ...(await download(...args)), digest: null }))
  expect(await f.run()).toMatchObject({ changed: 1, downloaded: 1, verified: 1, conflicts: ["note.md"] })
  expect(f.storage.download).toHaveBeenCalledTimes(1)
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("remote bytes")
})
it("bypasses ETag-MD5 adoption in content verification mode", async () => {
  const f = await fixture(),
    content = "same contents"
  Object.assign(f.storage, { etagContentHash: "md5" })
  await writeFile(join(f.a, "note.md"), content)
  const entry = f.put("note.md", content)
  entry.etag = `"${createHash("md5").update(content).digest("hex")}"`
  f.storage.head = vi.fn(async (key) => ({ ...f.objects.get(key)!, digest: null }))
  expect(await f.run(f.a, { verification: "content" })).toMatchObject({ verified: 1, conflicts: [] })
  expect(f.storage.head).toHaveBeenCalledTimes(1)
  expect(f.storage.download).toHaveBeenCalledTimes(1)
})
it("applies typed rules to remote objects and history without interpreting filtering as deletion", async () => {
  const f = await fixture()
  await mkdir(join(f.a, "d"))
  await writeFile(join(f.a, "d/note.md"), "base")
  await f.run()
  f.put("a", "excluded remote file")
  f.put("d/remote.md", "excluded remote child")
  const excludePath = createSyncExcludeFilter("{file:a;folder:d}")
  const result = await syncFiles({ root: f.a, files: await collectFiles({ root: f.a, excludePath }), stateDirectory: join(f.root, "state-a"), storage: f.storage, direction: "bidirectional", propagateDeletes: true, deleteThresholdPercent: 100, excludePath })
  expect(result).toMatchObject({ changed: 0, downloaded: 0, deleted: 0 })
  expect(f.objects.has("d/note.md")).toBe(true)
  expect(f.storage.remove).not.toHaveBeenCalled()
  await expect(readFile(join(f.a, "a"))).rejects.toMatchObject({ code: "ENOENT" })
})
it("emits structured diagnostics and isolates observer failures", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "note")
  const events: Array<{ type: string; action?: string; path?: string }> = []
  expect(
    await f.run(f.a, {
      /** Handles log events. */
      onLog: (event) => {
        events.push(event)
        if (event.type === "phase") throw new Error("diagnostics observer failed")
      }
    })
  ).toMatchObject({ changed: 1 })
  expect(events[0].type).toBe("start")
  expect(events).toContainEqual(expect.objectContaining({ type: "operation", path: "note.md", action: "upload" }))
  expect(events.at(-1)?.type).toBe("finish")
})

it("merges independent Markdown edits on two devices without creating conflict copies", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "# Title\n\nfirst\n\nlast\n")
  await f.run()
  await f.run(f.b)
  await writeFile(join(f.a, "note.md"), "# Title\n\nfirst edited by A\n\nlast\n")
  await writeFile(join(f.b, "note.md"), "# Title\n\nfirst\n\nlast edited by B\n")
  await f.run(f.b)
  const preview = await f.run(f.a, { dryRun: true })
  expect(preview.plan).toContainEqual({ path: "note.md", action: "merge", reason: "自动合并双方不重叠的 Markdown 修改" })
  expect(await readFile(join(f.a, "note.md"), "utf8")).not.toContain("last edited by B")
  expect(await f.run()).toMatchObject({ changed: 1, downloaded: 1, conflicts: [] })
  const merged = "# Title\n\nfirst edited by A\n\nlast edited by B\n"
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe(merged)
  expect(f.objects.get("note.md")?.content.toString()).toBe(merged)
  expect([...f.objects.keys()]).toEqual(["note.md"])
  expect(await f.run()).toMatchObject({ changed: 0, downloaded: 0, conflicts: [] })
  await f.run(f.b)
  expect(await readFile(join(f.b, "note.md"), "utf8")).toBe(merged)
})

it("keeps both versions if no common Markdown ancestor is available", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "local\n")
  f.put("note.md", "remote\n")
  expect(await f.run()).toMatchObject({ conflicts: ["note.md"] })
  expect(await readFile(join(f.a, `note.conflict-local-${digest("local\n")}.md`), "utf8")).toBe("local\n")
})

it("does not replace a newer remote version while uploading an automatic merge", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "a\nb\nc\n")
  await f.run()
  await writeFile(join(f.a, "note.md"), "A\nb\nc\n")
  f.put("note.md", "a\nb\nC\n")
  const upload = f.storage.upload
  vi.mocked(f.storage.upload).mockImplementationOnce(async (...args) => {
    f.put("note.md", "remote changed again\n")
    return upload(...args)
  })
  await expect(f.run()).rejects.toMatchObject({ code: "REMOTE_CONFLICT" })
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("A\nb\nc\n")
  expect(f.objects.get("note.md")?.content.toString()).toBe("remote changed again\n")
})

it("retains local edits made while an automatic merge is uploading", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "a\nb\nc\n")
  await f.run()
  await writeFile(join(f.a, "note.md"), "A\nb\nc\n")
  f.put("note.md", "a\nb\nC\n")
  const upload = f.storage.upload
  vi.mocked(f.storage.upload).mockImplementationOnce(async (...args) => {
    const receipt = await upload(...args)
    await writeFile(join(f.a, "note.md"), "new local edits during upload\n")
    return receipt
  })
  expect(await f.run()).toMatchObject({ skipped: ["note.md"] })
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("new local edits during upload\n")
})


it("does not trust a corrupted ancestor and leaves conflict copies recoverable", async () => {
  const f = await fixture()
  const base = "a\nb\nc\n"
  await writeFile(join(f.a, "note.md"), base)
  await f.run()
  await writeFile(join(f.root, "state-a", "backup-files-index.json.merge-bases", digest(base)), "corrupted")
  await writeFile(join(f.a, "note.md"), "A\nb\nc\n")
  f.put("note.md", "a\nb\nC\n")
  expect(await f.run()).toMatchObject({ conflicts: ["note.md"] })
  expect(await readFile(join(f.a, `note.conflict-local-${digest("A\nb\nc\n")}.md`), "utf8")).toBe("A\nb\nc\n")
})

it("keeps only current ancestor snapshots after successful edits", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "first")
  await f.run()
  await writeFile(join(f.a, "note.md"), "second")
  await f.run()
  expect(await readdir(join(f.root, "state-a", "backup-files-index.json.merge-bases"))).toEqual([digest("second")])
})

it("does not manufacture a two-sided conflict when the editor saves during upload", async () => {
  const f = await fixture()
  const path = join(f.a, "note.md")
  await writeFile(path, "base\n")
  await f.run()
  await writeFile(path, "saved version\n")
  const upload = f.storage.upload
  vi.mocked(f.storage.upload).mockImplementationOnce(async (key, source, options) => {
    expect(source).not.toBe(path)
    // The editor writes again before the adapter starts reading its upload source.
    await writeFile(path, "new edits while syncing\n")
    expect(await readFile(source, "utf8")).toBe("saved version\n")
    return upload(key, source, options)
  })
  expect(await f.run()).toMatchObject({ changed: 1, conflicts: [] })
  expect(f.objects.get("note.md")?.content.toString()).toBe("saved version\n")
  expect(await readFile(path, "utf8")).toBe("new edits while syncing\n")
  expect(await f.run()).toMatchObject({ changed: 1, downloaded: 0, conflicts: [] })
  expect(f.objects.get("note.md")?.content.toString()).toBe("new edits while syncing\n")
  expect([...f.objects.keys()]).toEqual(["note.md"])
})

it("records the uploaded ancestor when a new file is edited before upload finishes", async () => {
  const f = await fixture()
  const path = join(f.a, "note.md")
  await writeFile(path, "first save\n")
  const upload = f.storage.upload
  vi.mocked(f.storage.upload).mockImplementationOnce(async (...args) => {
    const receipt = await upload(...args)
    await writeFile(path, "second save\n")
    return receipt
  })
  expect(await f.run()).toMatchObject({ changed: 1, conflicts: [] })
  expect(await f.run()).toMatchObject({ changed: 1, conflicts: [] })
  expect(f.objects.get("note.md")?.content.toString()).toBe("second save\n")
  expect([...f.objects.keys()]).toEqual(["note.md"])
})

it("merges different edits within one paragraph and converges without any conflict files", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "姓名 Alice，年龄 20。\n")
  await f.run()
  await f.run(f.b)
  await writeFile(join(f.a, "note.md"), "姓名 Bob，年龄 20。\n")
  await writeFile(join(f.b, "note.md"), "姓名 Alice，年龄 21。\n")
  await f.run(f.b)
  expect(await f.run()).toMatchObject({ conflicts: [] })
  await f.run(f.b)
  for (const root of [f.a, f.b]) {
    expect(await readFile(join(root, "note.md"), "utf8")).toBe("姓名 Bob，年龄 21。\n")
    expect(await readdir(root)).toEqual(["note.md"])
  }
})
it("adopts equivalent line endings even on first sync without an ancestor", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "# 笔记\r\n正文\r\n")
  f.put("note.md", "# 笔记\n正文\n")
  expect(await f.run()).toMatchObject({ conflicts: [], changed: 1 })
  expect([...f.objects.keys()]).toEqual(["note.md"])
  expect(await f.run()).toMatchObject({ conflicts: [], changed: 0 })
})

it("defers a file edited during download while continuing to synchronize other files", async () => {
  const f = await fixture()
  await writeFile(join(f.a, "note.md"), "base")
  await f.run()
  f.put("note.md", "remote edit")
  await writeFile(join(f.a, "stable.md"), "stable note")
  const download = f.storage.download!
  vi.mocked(f.storage.download!).mockImplementationOnce(async (...args) => {
    const receipt = await download(...args)
    await writeFile(join(f.a, "note.md"), "typing during sync")
    return receipt
  })
  const result = await f.run()
  expect(result.skipped).toEqual(["note.md"])
  expect(result.conflicts).toEqual([])
  expect(f.objects.get("stable.md")?.content.toString()).toBe("stable note")
  expect(await readFile(join(f.a, "note.md"), "utf8")).toBe("typing during sync")
})
