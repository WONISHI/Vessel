import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from '@vessel/react-router'
import { ReadyRouter } from '@/components/app/ready-router'
import { restoreLoginWorkspace } from '@/router/login-workspace-restore'

const originalURL = window.location.href
const workspace = { path: '/remote-workspace', name: 'remote' }
afterEach(() => { cleanup(); window.history.replaceState(null, '', originalURL); vi.unstubAllGlobals(); localStorage.clear() })
function setup(get: (key: string) => Promise<unknown>, hash = '#/', changed = true) {
  window.history.replaceState(null, '', `${changed ? '?dataDomain=fixture&databaseSync=success' : '/'}${hash}`)
  vi.stubGlobal('electronAPI', { getAppState: vi.fn(get) })
}

it('keeps loading while checking the new domain and enters its workspace without rendering welcome', async () => {
  let finish!: (value: unknown) => void
  const pending = new Promise(resolve => { finish = resolve })
  setup(() => pending)
  const welcome = vi.fn(() => <main>开始使用</main>)
  const loading = <div role="status">Loading</div>
  const Application = lazy(async () => {
    await restoreLoginWorkspace()
    const router = createRouter({ history: createMemoryHistory([window.location.hash.slice(1)]), routes: [
      { path: '/', component: welcome }, { path: '/editor', component: () => <main>工作区</main> }
    ] })
    return { default: () => <ReadyRouter router={router} fallback={loading} /> }
  })
  render(<Suspense fallback={loading}><Application /></Suspense>)
  expect(screen.getByRole('status').textContent).toBe('Loading')
  expect(welcome).not.toHaveBeenCalled()
  await act(async () => { finish(workspace); await pending })
  await waitFor(() => expect(screen.getByText('工作区')).toBeTruthy())
  expect(welcome).not.toHaveBeenCalled()
  expect(JSON.parse(localStorage.getItem('app_current_workspace')!)).toEqual(workspace)
  expect(window.location.search).toContain('databaseSync=success')
  expect(screen.queryByRole('status')).toBeNull()
})

it('uses the welcome workspace record when the last-editor record is absent', async () => {
  setup(async key => key === 'workspace-last' ? null : workspace)
  await restoreLoginWorkspace()
  expect(window.location.hash).toBe('#/editor')
  expect(JSON.parse(localStorage.getItem('app_current_workspace')!)).toEqual(workspace)
})

it('keeps welcome when the authenticated account has no workspace record', async () => {
  setup(async () => null)
  await restoreLoginWorkspace()
  expect(window.location.hash).toBe('#/')
  expect(localStorage.getItem('app_current_workspace')).toBeNull()
})

it.each([['#/login', true], ['#/', false]])('preserves explicit logout and ordinary navigation: %s', async (hash, changed) => {
  const get = vi.fn().mockResolvedValue(workspace)
  setup(get, hash, changed)
  await restoreLoginWorkspace()
  expect(get).not.toHaveBeenCalled()
  expect(window.location.hash).toBe(hash)
})

it('does not navigate to a stale cached workspace when the authenticated domain cannot be read', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    setup(async () => { throw new Error('offline') })
    await restoreLoginWorkspace()
    expect(window.location.hash).toBe('#/')
    expect(localStorage.getItem('app_current_workspace')).toBeNull()
  } finally { vi.restoreAllMocks() }
})
