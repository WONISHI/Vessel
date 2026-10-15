import { writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { syncFiles, type BackupFile, type SyncProgress, type SyncOptions } from "@vessel/sync"
import type { AppSettings } from "@vessel/type"
import { createS3Storage } from "./settings-s3"
export { excludedBackupName } from "@vessel/sync"
export type { BackupFile } from "@vessel/sync"

/** Vessel metadata/status adapter; synchronization and transport live in @vessel/sync. */
export async function syncBackup(directory: string, config: AppSettings["backup"], secret: string, files: BackupFile[], metadata: unknown, onProgress?: (progress: SyncProgress) => void, runtime: Pick<SyncOptions, "root" | "paths" | "exclude" | "excludePath" | "onLog" | "dryRun"> = {}) {
  const metadataPath = join(directory, "backup-metadata.tmp")
  if (metadata !== undefined) await writeFile(metadataPath, JSON.stringify({ format: "vessel-files-v1", metadata }), { mode: 0o600 })
  try {
    const storage = createS3Storage(config, secret)
    let metadataUploads = 0
    const result = await syncFiles({
      stateDirectory: directory,
      storage: {
        ...storage,
        upload: async (key, source, options) => {
          const remote = await storage.upload(key, source, options)
          if (metadata !== undefined && source === metadataPath) metadataUploads++
          return remote
        }
      },
      ...runtime,
      direction: runtime.root ? (config.direction ?? "bidirectional") : "push",
      concurrency: config.concurrency ?? 8,
      conflictStrategy: config.conflictStrategy ?? "keep-both",
      propagateDeletes: config.propagateDeletes ?? false,
      deleteThresholdPercent: config.deleteThresholdPercent ?? 20,
      maxFileSize: (config.maxFileSizeMB ?? 0) * 1024 ** 2,
      prefix: config.prefix,
      files: [...files, ...(metadata === undefined ? [] : [{ path: ".vessel/backup.json", source: metadataPath }])],
      onProgress
    })
    return { ...result, changed: result.changed - metadataUploads }
  } finally {
    if (metadata !== undefined) await rm(metadataPath, { force: true })
  }
}
