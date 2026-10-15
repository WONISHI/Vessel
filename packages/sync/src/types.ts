export interface BackupFile {
  path: string
  source: string
}
export interface RemoteFile {
  digest: string | null
  etag: string | null
  size?: number
  modifiedMs?: number
}
export interface UploadOptions {
  digest: string
  size: number
  etag?: string
  signal?: AbortSignal
  onProgress?: (bytes: number) => void
  sourceVersion?: { mtimeMs: number; ctimeMs: number; ino: number; dev: number }
  modifiedMs?: number
}
/** id identifies the remote account/container; never include a secret. */
export interface StorageAdapter {
  readonly id: string
  readonly maxObjectSize?: number
  /** Supports positive comparison of plain single-part ETags to local MD5. */
  readonly etagContentHash?: "md5"
  head(key: string, signal?: AbortSignal): Promise<RemoteFile | undefined>
  /** Must create only if absent, or replace only when the supplied ETag still matches. */
  upload(key: string, source: string, options: UploadOptions): Promise<RemoteFile | void>
  /** Full paginated snapshot of keys under prefix. Unknown digests may be null. */
  list?(prefix: string, signal?: AbortSignal): Promise<ReadonlyMap<string, RemoteFile>>
  download?(key: string, destination: string, options: { etag?: string; signal?: AbortSignal; onProgress?: (bytes: number) => void }): Promise<RemoteFile>
  remove?(key: string, options: { etag: string; signal?: AbortSignal }): Promise<void>
}
export type SyncDirection = "push" | "pull" | "bidirectional"
export type ConflictStrategy = "keep-both" | "keep-newer" | "keep-larger" | "error"
export interface SyncPlanItem {
  path: string
  action: "upload" | "download" | "delete-local" | "delete-remote" | "conflict" | "equal" | "skip"
  reason: string
}
export interface SyncProgress {
  completed: number
  total: number
  uploaded: number
  bytes: number
  conflicts: number
  path: string
  phase?: "remote" | "hashing" | "planning" | "transferring"
  downloaded?: number
  active?: boolean
  elapsedMs?: number
}
export interface SyncResult {
  time: string
  size: number
  changed: number
  deleted: number
  downloaded?: number
  downloadSize?: number
  skipped?: string[]
  plan?: SyncPlanItem[]
  dryRun?: boolean
  conflicts: string[]
  checked: number
  hashed: number
  cached: number
  verified?: number
  durationMs: number
  running: false
}
export interface SyncOptions {
  /** Local state directory outside the backed-up tree. */
  stateDirectory: string
  storage: StorageAdapter
  files: readonly BackupFile[]
  prefix?: string
  /** Default push for backward compatibility. Pull/bidirectional require root and listing. */
  direction?: SyncDirection
  root?: string
  propagateDeletes?: boolean
  /** Prevent deleting more than this percentage of tracked files. Default 20, 100 disables. */
  deleteThresholdPercent?: number
  conflictStrategy?: ConflictStrategy
  maxFileSize?: number
  exclude?: (name: string) => boolean
  /** Restrict remote/history processing when syncing selected files. */
  paths?: readonly string[]
  dryRun?: boolean
  /** Default 8, maximum 32. Includes hashing, remote checks and streaming uploads. */
  concurrency?: number
  /** Default stat; content forces a fresh hash even when file metadata matches. */
  verification?: "stat" | "content"
  /** Flush after this many completed files, and always on completion/failure. Default 32. */
  checkpointEvery?: number
  signal?: AbortSignal
  onProgress?: (progress: SyncProgress) => void
  /** Existing app-compatible receipt filename. */
  indexName?: string
}
export type SyncErrorCode = "INVALID_PATH" | "FILE_CHANGED" | "FILE_TOO_LARGE" | "REMOTE_CONFLICT" | "S3_REQUEST" | "STATE_BUSY" | "INVALID_STATE" | "SYNC_FAILED" | "DELETE_PROTECTION" | "UNSUPPORTED"
export class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message: string,
    readonly details: { path?: string; status?: number; result?: SyncResult; cause?: unknown } = {}
  ) {
    super(message, { cause: details.cause })
    this.name = "SyncError"
  }
}
