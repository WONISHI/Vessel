import { expect, it } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SyncDiagnostics } from "@main/sync/sync-diagnostics"
it("bounds, persists, reloads and clears diagnostic records", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-sync-diagnostics-"))
  try {
    const logger = await new SyncDiagnostics(root).load()
    for (let index = 0; index < 1200; index++) logger.record({ type: "operation", message: `operation ${index}`, path: "note.md" })
    await logger.flush()
    const saved = JSON.parse(await readFile(join(root, "sync-diagnostics.json"), "utf8"))
    expect(saved).toHaveLength(1000)
    expect(saved[0].message).toBe("operation 200")
    const restored = await new SyncDiagnostics(root).load()
    expect(restored.get().entries).toHaveLength(200)
    expect(restored.get().entries[0].message).toBe("operation 1199")
    await restored.clear()
    expect(JSON.parse(await readFile(join(root, "sync-diagnostics.json"), "utf8"))).toEqual([])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
