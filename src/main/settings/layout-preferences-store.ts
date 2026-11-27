import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { LayoutPreferences } from '@vessel/type/layout-preferences'

function preferences(value: unknown): Partial<LayoutPreferences> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('布局配置无效')
  const patch: Partial<LayoutPreferences> = {}
  for (const key of ['activityBarCollapsed', 'statusBarVisible'] as const) {
    if (!Object.hasOwn(value, key)) continue
    if (typeof value[key] !== 'boolean') throw new TypeError('布局配置必须为布尔值')
    patch[key] = value[key]
  }
  return patch
}

/** Device-local UI preferences; independent of account, workspace and database domains. */
export class LayoutPreferencesStore {
  private value?: Partial<LayoutPreferences>
  constructor(private file: string) {}
  get(legacy: unknown = {}): LayoutPreferences {
    const migration = preferences(legacy)
    if (!this.value) {
      try { this.value = preferences(JSON.parse(readFileSync(this.file, 'utf8'))) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; this.value = {} }
    }
    const value = { activityBarCollapsed: false, statusBarVisible: true, ...migration, ...this.value }
    if (this.value.activityBarCollapsed === undefined || this.value.statusBarVisible === undefined) this.save(value)
    return { ...value }
  }
  set(input: unknown): LayoutPreferences {
    const patch = preferences(input)
    const value = { ...this.get(), ...patch }
    this.save(value)
    return { ...value }
  }
  private save(value: LayoutPreferences) {
    mkdirSync(dirname(this.file), { recursive: true })
    writeFileSync(this.file + '.tmp', JSON.stringify(value), { mode: 0o600 })
    renameSync(this.file + '.tmp', this.file)
    this.value = value
  }
}
