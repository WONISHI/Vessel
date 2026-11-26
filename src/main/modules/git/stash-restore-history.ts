import type { GitStashRestoreRecord } from '@vessel/type/git'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Application-local audit records keyed by absolute Git directory and stable stash object ID. */
export class StashRestoreHistory {
  private records: Record<string, GitStashRestoreRecord[]> = {}
  private loadError: unknown
  private ready: Promise<void>
  private writes = Promise.resolve()
  constructor(private path?: string) {
    this.ready = this.load().catch(error => { this.loadError = error })
  }
  private async load() {
    if (!this.path) return
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'))
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('贮藏恢复记录格式无效')
      this.records = data
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  async list(repository: string): Promise<GitStashRestoreRecord[]> {
    await this.ready
    if (this.loadError) throw this.loadError
    return [...(this.records[repository] || [])]
  }
  async append(repository: string, record: GitStashRestoreRecord) {
    await this.ready
    if (this.loadError) throw this.loadError
    const write = this.writes.catch(() => {}).then(async () => {
      const previous = this.records[repository] || []
      const next = { ...this.records, [repository]: [record, ...previous].slice(0, 1000) }
      if (this.path) {
        await mkdir(dirname(this.path), { recursive: true })
        const temporary = this.path + '.tmp'
        await writeFile(temporary, JSON.stringify(next), { mode: 0o600 })
        await rename(temporary, this.path)
      }
      this.records = next
    })
    this.writes = write
    await write
  }
}
