const { mkdtemp, writeFile, rm } = require("node:fs/promises")
const { tmpdir } = require("node:os")
const { join } = require("node:path")
const { setTimeout: delay } = require("node:timers/promises")
const { syncFiles } = require("../dist/index.js")
async function main() {
  const root = await mkdtemp(join(tmpdir(), "vessel-sync-benchmark-"))
  try {
    const files = await Promise.all(
      Array.from({ length: 256 }, async (_, i) => {
        const source = join(root, `${i}.md`)
        await writeFile(source, Buffer.alloc(16 * 1024, i))
        return { path: `${i}.md`, source }
      })
    )
    const rows = []
    for (const mode of ["per-file-head", "batch-list"]) {
      const remote = new Map()
      let requests = 0
      const storage = {
        id: "benchmark",
        head: async (key) => {
          requests++
          await delay(10)
          return remote.get(key)
        },
        upload: async (key, _source, input) => {
          requests++
          await delay(10)
          const value = { digest: input.digest, etag: `"${input.digest}"`, size: input.size }
          remote.set(key, value)
          return value
        },
        ...(mode === "batch-list"
          ? {
              list: async () => {
                requests++
                await delay(10)
                return new Map([...remote].map(([key, value]) => [key, { ...value, digest: null }]))
              }
            }
          : {})
      }
      const options = { files, storage, stateDirectory: join(root, mode), concurrency: mode === "batch-list" ? 8 : 4 }
      for (const run of ["initial", "unchanged"]) {
        requests = 0
        const result = await syncFiles(options)
        rows.push({ mode, run, milliseconds: Math.round(result.durationMs), requests, hashed: result.hashed, cached: result.cached, uploaded: result.changed })
      }
    }
    console.table(rows)
    for (const run of ["initial", "unchanged"]) {
      const before = rows.find((row) => row.mode === "per-file-head" && row.run === run)
      const after = rows.find((row) => row.mode === "batch-list" && row.run === run)
      console.log(`${run}: ${(before.milliseconds / after.milliseconds).toFixed(2)}x; ${before.requests} -> ${after.requests} requests`)
    }
    console.log("Synthetic transport, 256 × 16 KiB files, 10 ms per remote operation; not live S3.")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
