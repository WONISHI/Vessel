import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export interface WorkspaceSession {
  files: { name: string; path: string }[]
  active: string
  expanded: string[]
}

/** Validate local snapshots as well as IPC payloads. */
export function workspaceSession(value: unknown): WorkspaceSession | null {
  if (!value || typeof value !== "object") return null
  const data = value as Partial<WorkspaceSession>
  if (!Array.isArray(data.files) || data.files.length > 500 || typeof data.active !== "string") return null
  return {
    files: data.files.filter(file => file && typeof file.name === "string" && typeof file.path === "string").map(({ name, path }) => ({ name, path })),
    active: data.active,
    expanded: Array.isArray(data.expanded) ? [...new Set(data.expanded.filter(path => typeof path === "string"))].slice(0, 5000) : []
  }
}

/** In-memory reads and updates; serialized, debounced, atomic JSON disk writes. */
export class WorkspaceSessionStore {
  private entries = new Map<string, WorkspaceSession>()
  private ready: Promise<void>
  private revision = 0
  private persisted = 0
  private writing: Promise<void> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor(private file: string) {
    this.ready = this.load()
  }

  private async load() {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8"))
      if (!data || typeof data !== "object" || Array.isArray(data)) return
      for (const [key, value] of Object.entries(data).slice(-100)) {
        const session = workspaceSession(value)
        if (session) this.entries.set(key, session)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("读取工作区会话缓存失败", error)
    }
  }

  async get(key: string) {
    await this.ready
    const value = this.entries.get(key)
    return value ? structuredClone(value) : null
  }

  async set(key: string, value: unknown) {
    const session = workspaceSession(value)
    if (!session) throw new TypeError("工作区会话无效")
    await this.ready
    this.entries.delete(key)
    this.entries.set(key, session)
    if (this.entries.size > 100) this.entries.delete(this.entries.keys().next().value!)
    this.revision++
    clearTimeout(this.timer)
    this.timer = setTimeout(() => { void this.flush()?.catch(error => console.error("保存工作区会话缓存失败", error)) }, 300)
    this.timer.unref?.()
  }

  /** Returns null when clean, allowing the existing quit drain to finish. */
  flush(): Promise<void> | null {
    clearTimeout(this.timer)
    if (this.writing) return this.writing
    if (this.persisted === this.revision) return null
    this.writing = (async () => {
      await this.ready
      await mkdir(dirname(this.file), { recursive: true })
      while (this.persisted !== this.revision) {
        const revision = this.revision
        const json = JSON.stringify(Object.fromEntries(this.entries))
        const temporary = this.file + ".tmp"
        await writeFile(temporary, json, "utf8")
        await rename(temporary, this.file)
        this.persisted = revision
      }
    })().finally(() => { this.writing = undefined })
    return this.writing
  }
}
