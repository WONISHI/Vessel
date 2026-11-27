import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { LayoutPreferencesStore } from '@main/settings/layout-preferences-store'
const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'vessel-layout-')); directories.push(directory)
  const file = join(directory, 'state', 'layout-preferences.json')
  return { file, store: new LayoutPreferencesStore(file) }
}
it('keeps both device-local choices after recreating the store, without a database', () => {
  const { file, store } = fixture()
  expect(store.get()).toEqual({ activityBarCollapsed: false, statusBarVisible: true })
  store.set({ activityBarCollapsed: true })
  store.set({ statusBarVisible: false })
  expect(new LayoutPreferencesStore(file).get()).toEqual({ activityBarCollapsed: true, statusBarVisible: false })
  store.set({ statusBarVisible: true })
  expect(store.get().activityBarCollapsed).toBe(true)
})
it('migrates legacy choices once and never lets another account or window reset saved choices', () => {
  const { file, store } = fixture()
  expect(store.get({ activityBarCollapsed: true, statusBarVisible: false })).toEqual({ activityBarCollapsed: true, statusBarVisible: false })
  expect(new LayoutPreferencesStore(file).get({ activityBarCollapsed: false, statusBarVisible: true })).toEqual({ activityBarCollapsed: true, statusBarVisible: false })
  const original = readFileSync(file, 'utf8')
  expect(() => store.set({ statusBarVisible: 'false' })).toThrow('布尔值')
  expect(readFileSync(file, 'utf8')).toBe(original)
})
