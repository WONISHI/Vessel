import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readFile, writeFile, rename, stat, rm } from "node:fs/promises"
import { join } from "node:path"
import type { AppSettings } from "../shared/settings"
import { headS3File, uploadS3File } from "./settings-s3"
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex")
export type BackupFile = { path: string; source: string; stable?: boolean }
type Entry = { size: number; digest: string }
type Index = { target: string; files: Record<string, Entry> }
export const excludedBackupName = (name: string) => [".git", "node_modules", ".cache", ".DS_Store", "dist", "build", "out", "coverage", ".next", ".nuxt", ".turbo", ".aws", ".ssh", "credentials", "settings.json.tmp"].includes(name)
  || /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|log)$/i.test(name)

/** Incremental push of ordinary files. Local removals never delete a remote backup. */
export async function syncBackup(directory: string, config: AppSettings["backup"], secret: string, files: BackupFile[], metadata: unknown) {
  const prefix = config.prefix.replace(/^\/+|\/+$/g, "")
  const target = hash(JSON.stringify([config.endpoint, config.bucket, config.region, config.accessKey, prefix]))
  // Separate index: never mistake legacy chunk receipts for uploaded ordinary files.
  const indexPath = join(directory, "backup-files-index.json")
  let previous: Index = { target, files: {} }
  try { const saved = JSON.parse(await readFile(indexPath, "utf8")); if (saved.target === target) previous = saved } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const next: Index = { target, files: { ...previous.files } }
  let transferred = 0, changed = 0
  const metadataPath = join(directory, "backup-metadata.tmp")
  if (metadata !== undefined) await writeFile(metadataPath, JSON.stringify({ format: "vessel-files-v1", metadata }), { mode: 0o600 })
  try {
    for (const file of [...files, ...(metadata === undefined ? [] : [{ path: ".vessel/backup.json", source: metadataPath }])]) {
      if (file.path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("同步文件路径无效")
      const before = await stat(file.source)
      if (before.size > 5 * 1024 ** 3) throw new Error(`单个文件超过 S3 普通上传的 5 GB 限制：${file.path}`)
      const hasher = createHash("sha256")
      for await (const chunk of createReadStream(file.source)) hasher.update(chunk)
      const digest = hasher.digest("hex")
      const afterHash = await stat(file.source)
      if (before.size !== afterHash.size || before.mtimeMs !== afterHash.mtimeMs) throw new Error(`同步期间文件已变化，将在下次重试：${file.path}`)
      const key = [prefix, file.path].filter(Boolean).join("/")
      const remote = await headS3File(config, secret, key)
      if (remote?.digest !== digest) {
        const old = previous.files[file.path]
        if (remote && (!old || remote.digest !== old.digest || !remote.etag)) throw new Error(`远端文件与上次同步不一致，未覆盖：${file.path}`)
        await uploadS3File(config, secret, key, file.source, digest, before.size, remote?.etag ?? undefined)
        transferred += before.size
        if (file.source !== metadataPath) changed++
      }
      const after = await stat(file.source)
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error(`同步期间文件已变化，将在下次重试：${file.path}`)
      next.files[file.path] = { size: before.size, digest }
      // Persist each successful receipt so a later failure can be retried safely.
      await writeFile(indexPath + ".tmp", JSON.stringify(next), { mode: 0o600 })
      await rename(indexPath + ".tmp", indexPath)
    }
  } finally { await rm(metadataPath, { force: true }) }
  return { time: new Date().toISOString(), size: transferred, changed, deleted: 0, running: false }
}
