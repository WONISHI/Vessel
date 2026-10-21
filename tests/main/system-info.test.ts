import { getDatabaseStorageBytes } from "@main/modules/welcome/system-info"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it } from "vitest"

it("counts database and existing sidecars without requiring WAL files", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-system-info-"))
  const path = join(root, "vessel.db")
  try {
    expect(await getDatabaseStorageBytes(path)).toBe(0)
    await writeFile(path, Buffer.alloc(100))
    expect(await getDatabaseStorageBytes(path)).toBe(100)
    await writeFile(`${path}-wal`, Buffer.alloc(20))
    await writeFile(`${path}-shm`, Buffer.alloc(10))
    expect(await getDatabaseStorageBytes(path)).toBe(130)
  } finally { await rm(root, { recursive: true, force: true }) }
})
