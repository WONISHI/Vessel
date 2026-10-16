import type { BackupLogEntry } from "@vessel/type"
import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
const stores = new Map<string, Promise<SyncDiagnostics>>()
const limit = 1000
/** Bounded, batched diagnostic storage; no filesystem work on each progress event. */
export class SyncDiagnostics {
  private entries: BackupLogEntry[] = []
  private timer?: ReturnType<typeof setTimeout>
  private writes: Promise<void> = Promise.resolve()
  private dirty = false
  private warning?: string

  /** Initializes the instance and its required dependencies. */
  constructor(private directory: string) {}

  /** Loads load. */
  async load() {
    try {
      const saved = JSON.parse(await readFile(join(this.directory, "sync-diagnostics.json"), "utf8"))
      if (Array.isArray(saved))
        this.entries = saved
          .filter((entry) => entry && typeof entry.message === "string" && typeof entry.time === "string" && typeof entry.id === "string")
          .slice(-limit)
          .map((entry) => ({
            id: entry.id,
            time: entry.time,
            type: typeof entry.type === "string" ? entry.type : "info",
            message: entry.message.slice(0, 4096),
            path: typeof entry.path === "string" ? entry.path.slice(0, 2048) : undefined,
            action: typeof entry.action === "string" ? entry.action : undefined,
            code: typeof entry.code === "string" ? entry.code : undefined
          }))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") this.warning = "旧诊断日志无法读取"
    }
    return this
  }

  /** Performs the record operation. */
  record(entry: Omit<BackupLogEntry, "id" | "time">) {
    this.entries.push({ ...entry, message: entry.message.slice(0, 4096), path: entry.path?.slice(0, 2048), id: randomUUID(), time: new Date().toISOString() })
    if (this.entries.length > limit) this.entries.splice(0, this.entries.length - limit)
    this.dirty = true
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = undefined
        void this.flush()
      }, 1000)
      this.timer.unref()
    }
  }

  /** Returns get. */
  get() {
    return {
      entries: this.entries
        .slice(-200)
        .reverse()
        .map((entry) => ({ ...entry })),
      warning: this.warning
    }
  }

  /** Clears clear. */
  async clear() {
    this.entries = []
    this.dirty = true
    await this.flush()
  }

  /** Performs the flush operation. */
  async flush() {
    clearTimeout(this.timer)
    this.timer = undefined
    if (this.dirty) {
      this.dirty = false
      const body = JSON.stringify(this.entries)
      this.writes = this.writes
        .then(async () => {
          await mkdir(this.directory, { recursive: true })
          const file = join(this.directory, "sync-diagnostics.json")
          await writeFile(file + ".tmp", body, { mode: 0o600 })
          await rename(file + ".tmp", file)
          this.warning = undefined
        })
        .catch(() => {
          this.warning = "诊断日志写入失败；同步不受影响"
        })
    }
    await this.writes
  }
}

/** Returns sync diagnostics. */
export function getSyncDiagnostics(directory: string) {
  let store = stores.get(directory)
  if (!store) {
    store = new SyncDiagnostics(directory).load()
    stores.set(directory, store)
  }
  return store
}
