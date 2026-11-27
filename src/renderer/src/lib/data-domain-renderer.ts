/** Remote-domain UI caches never reuse this device's persistent local workspace state. */
class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(String(key)) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(String(key)) }
  setItem(key: string, value: string) { this.values.set(String(key), String(value)) }
}
export async function prepareDataDomainRenderer() {
  const api = window.electronAPI?.databaseSync
  if (!api) return
  const status = await api.status()
  if (status.source === 'remote') {
    Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
    Object.defineProperty(window, 'sessionStorage', { configurable: true, value: new MemoryStorage() })
  }
  await api.ready()
}
export function reloadDataDomainRenderer(destination = "/", synchronized = false) {
  const url = new URL(window.location.href)
  url.hash = `#${destination}`
  url.searchParams.set('dataDomain', String(Date.now()))
  if (synchronized) url.searchParams.set('databaseSync', 'success')
  else url.searchParams.delete('databaseSync')
  window.location.replace(url.href)
}

/** Consume once after the new domain has loaded, so a reload cannot swallow the notification. */
export function consumeDatabaseSyncSuccess(): boolean {
  const url = new URL(window.location.href)
  if (url.searchParams.get('databaseSync') !== 'success') return false
  url.searchParams.delete('databaseSync')
  window.history.replaceState(window.history.state, '', url.href)
  return true
}
