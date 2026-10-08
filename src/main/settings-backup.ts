import { createHash, randomUUID } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, writeFile, rename, stat } from "node:fs/promises"
import { join } from "node:path"
import type { AppSettings } from "../shared/settings"
import { requestS3 } from "./settings-s3"
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
export type BackupFile = { path: string; source: string; stable?: boolean }
type Entry = { size: number; mtime: number; chunks: string[] }
type Index = { target: string; files: Record<string, Entry> }
export const excludedBackupName = (name: string) => [".git", "node_modules", ".cache", ".DS_Store", "dist", "build", "out", "coverage", ".next", ".nuxt", ".turbo", ".aws", ".ssh", "credentials", "settings.json.tmp"].includes(name)
  || /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|log)$/i.test(name)
/** Content-addressed 4 MB chunks, committed by one final manifest PUT. Failed runs never advance the local index. */
export async function syncBackup(directory: string, config: AppSettings["backup"], secret: string, files: BackupFile[], metadata: unknown) {
  const devicePath = join(directory, "backup-device-id")
  let device: string
  try { device = (await readFile(devicePath, "utf8")).trim() } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    device = randomUUID(); await writeFile(devicePath, device, { mode: 0o600 })
  }
  const prefix = [config.prefix.replace(/^\/+|\/+$/g, ""), "vessel-sync", device].filter(Boolean).join("/")
  const target = hash(JSON.stringify([config.endpoint, config.bucket, config.region, config.accessKey, prefix]))
  const indexPath = join(directory, "backup-index.json")
  let previous: Index = { target, files: {} }
  try { const saved = JSON.parse(await readFile(indexPath, "utf8")); if (saved.target === target) previous = saved } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const uploaded = new Set(Object.values(previous.files).flatMap(entry => entry.chunks))
  const next: Index = { target, files: {} }
  let transferred = 0, changed = 0
  for (const file of files) {
    const before = await stat(file.source)
    const old = previous.files[file.path]
    if (file.stable !== false && old && old.size === before.size && old.mtime === before.mtimeMs) { next.files[file.path] = old; continue }
    const chunks: string[] = []
    for await (const chunk of createReadStream(file.source, { highWaterMark: 4 * 1024 * 1024 })) {
      const digest = hash(chunk); chunks.push(digest)
      if (!uploaded.has(digest)) {
        await requestS3(config, secret, "PUT", `${prefix}/blobs/${digest}`, chunk)
        uploaded.add(digest); transferred += chunk.length
      }
    }
    const after = await stat(file.source)
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`同步期间文件已变化，将在下次重试：${file.path}`)
    const entry = { size: before.size, mtime: before.mtimeMs, chunks }
    next.files[file.path] = entry
    if (!old || old.size !== entry.size || JSON.stringify(old.chunks) !== JSON.stringify(chunks)) changed++
  }
  const deleted = Object.keys(previous.files).filter(path => !next.files[path])
  const time = new Date().toISOString()
  const manifest = Buffer.from(JSON.stringify({ format: "vessel-sync-v2", time, device, metadata, files: next.files, deleted }))
  // Immutable revision first; latest is only updated after every referenced blob exists.
  await requestS3(config, secret, "PUT", `${prefix}/revisions/${time.replace(/[:.]/g, "-")}.json`, manifest)
  await requestS3(config, secret, "PUT", `${prefix}/latest.json`, manifest)
  await writeFile(indexPath + ".tmp", JSON.stringify(next), { mode: 0o600 })
  await rename(indexPath + ".tmp", indexPath)
  return { time, size: transferred + manifest.length * 2, changed, deleted: deleted.length, running: false }
}
