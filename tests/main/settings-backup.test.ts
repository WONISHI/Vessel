import { expect, it, vi } from "vitest"
import { mkdtemp, writeFile, readFile, rm, utimes, stat } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "@vessel/utils"
const mocks = vi.hoisted(() => ({ head: vi.fn(), upload: vi.fn() }))
vi.mock("@main/sync/settings-s3", () => ({
  createS3Storage: (config, secret) => ({
    id: JSON.stringify([config.endpoint, config.bucket, config.region, config.accessKey, config.prefix.replace(/^\/+|\/+$/g, "")]),
    maxObjectSize: 5 * 1024 ** 3,
    head: (key) => mocks.head(config, secret, key),
    upload: (key, source, input) => mocks.upload(config, secret, key, source, input.digest, input.size, input.etag)
  })
}))
import { syncBackup, excludedBackupName } from "@main/sync/settings-backup"
it("pushes readable files, compares content, repairs missing objects and protects remote changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-incremental-"))
  const remote = new Map<string, { digest: string; etag: string; content: Buffer }>()
  mocks.head.mockImplementation(async (_c, _s, key) => remote.get(key))
  mocks.upload.mockImplementation(async (_c, _s, key, source, digest) => remote.set(key, { digest, etag: '"etag"', content: await readFile(source) }))
  try {
    const source = join(root, "large.bin")
    await writeFile(source, Buffer.alloc(9 * 1024 * 1024, 1))
    const config = { ...defaultSettings.backup, conflictStrategy: "keep-both" as const, propagateDeletes: false, prefix: "notes", endpoint: "https://example.com", bucket: "test" }
    const files = [{ path: "workspace/中文.bin", source }]
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ changed: 1 })
    expect(remote.get("notes/workspace/中文.bin")?.content.length).toBe(9 * 1024 * 1024)
    expect([...remote.keys()].some((key) => key.includes("vessel-sync") || key.includes("blobs"))).toBe(false)
    mocks.upload.mockClear()
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ changed: 0, size: 0 })
    expect(mocks.upload).not.toHaveBeenCalled()
    const before = await stat(source)
    await writeFile(source, Buffer.alloc(before.size, 2))
    await utimes(source, before.atime, before.mtime)
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ changed: 1 })
    expect(mocks.upload.mock.calls[0][6]).toBe('"etag"')
    const committed = await readFile(join(root, "backup-files-index.json"), "utf8")
    await writeFile(source, "modified")
    mocks.upload.mockRejectedValueOnce(new Error("offline"))
    await expect(syncBackup(root, config, "secret", files, undefined)).rejects.toThrow("offline")
    expect(await readFile(join(root, "backup-files-index.json"), "utf8")).toBe(committed)
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ changed: 1 })
    remote.delete("notes/workspace/中文.bin")
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ changed: 1 })
    remote.get("notes/workspace/中文.bin")!.digest = "external-edit"
    mocks.upload.mockClear()
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ conflicts: ["workspace/中文.bin"], changed: 1 })
    expect(remote.get("notes/workspace/中文.bin")!.digest).toBe("external-edit")
    const conflictKey = [...remote.keys()].find((key) => key.startsWith("notes/.vessel/conflicts/"))!
    expect(remote.get(conflictKey)!.content.toString()).toBe("modified")
    mocks.upload.mockClear()
    expect(await syncBackup(root, config, "secret", files, undefined)).toMatchObject({ conflicts: ["workspace/中文.bin"], changed: 0 })
    expect(mocks.upload).not.toHaveBeenCalled()
    // Lost receipts and objects without Vessel metadata must not abort the rest of the run.
    await rm(join(root, "backup-files-index.json"))
    remote.get("notes/workspace/中文.bin")!.digest = null as unknown as string
    const extra = join(root, "extra.md")
    await writeFile(extra, "next file")
    expect(await syncBackup(root, config, "secret", [...files, { path: "next.md", source: extra }], undefined)).toMatchObject({ conflicts: ["workspace/中文.bin"], changed: 1 })
    expect(remote.get("notes/next.md")!.content.toString()).toBe("next file")
    expect(await syncBackup(root, config, "secret", [], undefined)).toMatchObject({ deleted: 0 })
    expect(remote.has("notes/workspace/中文.bin")).toBe(true)
    expect(excludedBackupName(".env.local")).toBe(true)
    expect(excludedBackupName("node_modules")).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
