import { expect, it, vi } from "vitest"
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { defaultSettings } from "../../src/shared/settings"
const request = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => {}))
vi.mock("../../src/main/settings-s3", () => ({ requestS3: request }))
import { syncBackup, excludedBackupName } from "../../src/main/settings-backup"
it("uploads bounded chunks, skips unchanged files, and commits deletions only after successful upload", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-incremental-"))
  try {
    const source = join(root, "large.bin")
    await writeFile(source, Buffer.alloc(9 * 1024 * 1024, 1))
    const config = { ...defaultSettings.backup, endpoint: "https://example.com", bucket: "test" }
    const files = [{ path: "workspace/large.bin", source }]
    await syncBackup(root, config, "secret", files, {})
    const blobs = request.mock.calls.filter(call => String(call[3]).includes("/blobs/"))
    expect(blobs.length).toBe(2) // Two identical 4 MB chunks are deduplicated.
    expect(blobs.every(call => (call[4] as Buffer).length <= 4 * 1024 * 1024)).toBe(true)
    request.mockClear()
    expect(await syncBackup(root, config, "secret", files, {})).toMatchObject({ changed: 0 })
    expect(request.mock.calls.some(call => String(call[3]).includes("/blobs/"))).toBe(false)
    const committed = await readFile(join(root, "backup-index.json"), "utf8")
    await writeFile(source, "modified")
    request.mockRejectedValueOnce(new Error("offline"))
    await expect(syncBackup(root, config, "secret", files, {})).rejects.toThrow("offline")
    expect(await readFile(join(root, "backup-index.json"), "utf8")).toBe(committed)
    expect(await syncBackup(root, config, "secret", files, {})).toMatchObject({ changed: 1 })
    expect(await syncBackup(root, config, "secret", [], {})).toMatchObject({ deleted: 1 })
    const manifest = JSON.parse((request.mock.calls.at(-1)![4] as Buffer).toString())
    expect(manifest.deleted).toEqual(["workspace/large.bin"])
    expect(excludedBackupName(".env.local")).toBe(true)
    expect(excludedBackupName("node_modules")).toBe(true)
  } finally { await rm(root, { recursive: true, force: true }) }
})
