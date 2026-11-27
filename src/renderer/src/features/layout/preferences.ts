import { useSyncExternalStore } from 'react'
import type { LayoutPreferences } from '@vessel/type/layout-preferences'

let value: LayoutPreferences = { activityBarCollapsed: false, statusBarVisible: true }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const receive = (next: LayoutPreferences) => {
  if (value.activityBarCollapsed === next.activityBarCollapsed && value.statusBarVisible === next.statusBarVisible) return
  value = { ...next }
  listeners.forEach(listener => listener())
}
let ready: Promise<void> | undefined

/** Load before rendering, outside the login domain's isolated browser storage. */
export function initializeLayoutPreferences(): Promise<void> {
  if (ready) return ready
  const api = window.electronAPI?.layoutPreferences
  if (!api) return Promise.resolve()
  const legacy: Partial<LayoutPreferences> = {}
  try {
    const activity = localStorage.getItem('vessel-activity-bar-collapsed'), status = localStorage.getItem('vessel-status-bar-visible')
    if (activity === 'true' || activity === 'false') legacy.activityBarCollapsed = activity === 'true'
    if (status === 'true' || status === 'false') legacy.statusBarVisible = status === 'true'
  } catch { /* Browser storage is only read once for migration. */ }
  api.onChanged(receive)
  ready = api.get(legacy).then(receive).catch(error => { console.error('读取本机布局配置失败', error) })
  return ready
}

export function setLayoutPreferences(patch: Partial<LayoutPreferences>) {
  receive({ ...value, ...patch })
  const api = window.electronAPI?.layoutPreferences
  if (api) void api.set(patch).catch(error => { console.error('保存本机布局配置失败', error) })
}

export function useLayoutPreferences() {
  return useSyncExternalStore(subscribe, () => value, () => value)
}
