import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useGitAutoFetch } from '@/pages/git/hooks/use-git-auto-fetch'

beforeEach(() => vi.useFakeTimers())
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks() })
const setup = (fetch = vi.fn().mockResolvedValue(undefined)) => {
  window.electronAPI = { git: { fetch } } as unknown as typeof window.electronAPI
  return fetch
}
const settle = async () => { await act(async () => { await Promise.resolve() }) }

it('fetches on entry, refreshes counts after success, and throttles focus and periodic checks', async () => {
  const fetch = setup(), refresh = vi.fn().mockResolvedValue(undefined)
  const { unmount } = renderHook(() => useGitAutoFetch('/auto-fetch-entry', true, refresh, { current: false }))
  await settle()
  expect(fetch).toHaveBeenCalledExactlyOnceWith('/auto-fetch-entry', undefined, { all: true, prune: false, tags: false, background: true })
  expect(refresh).toHaveBeenCalledExactlyOnceWith(true)
  act(() => window.dispatchEvent(new Event('focus')))
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000) })
  expect(fetch).toHaveBeenCalledTimes(2)
  unmount()
  await act(async () => { await vi.advanceTimersByTimeAsync(120_000) })
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('does not apply stale results after switching repositories', async () => {
  let finish = () => {}
  const fetch = setup(vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve })).mockResolvedValue(undefined))
  const refresh = vi.fn().mockResolvedValue(undefined), busy = { current: false }
  const { rerender } = renderHook(({ path }) => useGitAutoFetch(path, true, refresh, busy), { initialProps: { path: '/auto-fetch-old' } })
  rerender({ path: '/auto-fetch-new' })
  await settle()
  expect(refresh).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(refresh).toHaveBeenCalledTimes(1)
})

it('retains cached status on failure and skips checks during user remote operations', async () => {
  const fetch = setup(vi.fn().mockRejectedValue(new Error('offline'))), refresh = vi.fn(), busy = { current: true }
  renderHook(() => useGitAutoFetch('/auto-fetch-failure', true, refresh, busy))
  expect(fetch).not.toHaveBeenCalled()
  busy.current = false
  act(() => window.dispatchEvent(new Event('focus')))
  await settle()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(refresh).not.toHaveBeenCalled()
})
