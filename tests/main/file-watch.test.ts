import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { subscribe } from "@parcel/watcher"
import { expect, it } from "vitest"
it("observes Markdown creation, external content updates and deletion", async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), "vessel-watch-")))
  const path = join(directory, "note.md")
  const events: string[] = []
  const subscription = await subscribe(directory, (error, changes) => {
    if (error) throw error
    events.push(...changes.filter(event => event.path === path).map(event => event.type))
  })
  try {
    await writeFile(path, "# created")
    await expect.poll(() => events.includes("create"), { timeout: 5000 }).toBe(true)
    await writeFile(path, "# updated")
    await expect.poll(() => events.includes("update"), { timeout: 5000 }).toBe(true)
    await rm(path)
    await expect.poll(() => events.includes("delete"), { timeout: 5000 }).toBe(true)
  } finally { await subscription.unsubscribe(); await rm(directory, { recursive: true, force: true }) }
}, 20000)
