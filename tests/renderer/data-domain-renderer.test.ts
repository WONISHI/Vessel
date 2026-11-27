import { afterEach, expect, it, vi } from 'vitest'
import { consumeDatabaseSyncSuccess, prepareDataDomainRenderer } from '@/lib/data-domain-renderer'
const local = Object.getOwnPropertyDescriptor(window, 'localStorage')!
const session = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!
afterEach(() => { Object.defineProperty(window, 'localStorage', local); Object.defineProperty(window, 'sessionStorage', session); vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear() })
it('isolates remote UI caches without modifying persistent local caches', async () => {
  const native = window.localStorage
  native.setItem('app_current_workspace', 'local workspace')
  sessionStorage.setItem('local-tab', 'local tab')
  const ready = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('electronAPI', { databaseSync: { status: async () => ({ source: 'remote' }), ready } })
  await prepareDataDomainRenderer()
  expect(localStorage.getItem('app_current_workspace')).toBeNull()
  expect(sessionStorage.getItem('local-tab')).toBeNull()
  localStorage.setItem('app_current_workspace', 'remote workspace')
  expect(localStorage.getItem('app_current_workspace')).toBe('remote workspace')
  expect(native.getItem('app_current_workspace')).toBe('local workspace')
  expect(ready).toHaveBeenCalledOnce()
})
it('uses original browser storage when logged out', async () => {
  const native = window.localStorage
  native.setItem('app_current_workspace', 'local workspace')
  vi.stubGlobal('electronAPI', { databaseSync: { status: async () => ({ source: 'local' }), ready: vi.fn().mockResolvedValue(undefined) } })
  await prepareDataDomainRenderer()
  expect(window.localStorage).toBe(native)
  expect(localStorage.getItem('app_current_workspace')).toBe('local workspace')
})

it('consumes the completed-sync notification once while preserving the domain and selected route', () => {
  const previous = window.location.href
  window.history.replaceState({ fixture: true }, '', '?dataDomain=123&databaseSync=success#/editor')
  try {
    expect(consumeDatabaseSyncSuccess()).toBe(true)
    expect(window.location.search).toBe('?dataDomain=123')
    expect(window.location.hash).toBe('#/editor')
    expect(window.history.state).toEqual({ fixture: true })
    expect(consumeDatabaseSyncSuccess()).toBe(false)
  } finally { window.history.replaceState(null, '', previous) }
})
