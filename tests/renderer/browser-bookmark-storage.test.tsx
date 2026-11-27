import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useBrowserBookmarks } from '@/pages/browser/use-browser-bookmarks'
const errors = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/sonner', () => ({ toast: { error: errors } }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); errors.mockClear() })
const custom = [{ url: 'https://custom.example', title: '自定义书签' }]
function fixture(saved: unknown, source = 'remote') {
  const sync = vi.fn().mockResolvedValue(undefined)
  let receive!: (items: typeof custom) => void
  vi.stubGlobal('electronAPI', {
    getBrowserBookmarks: vi.fn().mockResolvedValue(saved), syncBrowserBookmarks: sync,
    databaseSync: { status: vi.fn().mockResolvedValue({ source }) },
    onBrowserBookmarksUpdated: (callback: typeof receive) => { receive = callback; return () => {} }
  })
  const hook = renderHook(useBrowserBookmarks)
  return { ...hook, sync, receive: (items: typeof custom) => receive(items) }
}

it('reads synced bookmarks from the active database without writing defaults on an empty renderer cache', async () => {
  const { result, sync } = fixture(custom)
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual(custom)
  expect(sync).not.toHaveBeenCalled()
})

it('keeps an intentionally empty remote bookmark list and never imports another domain cache', async () => {
  localStorage.setItem('browser-bookmarks', JSON.stringify(custom))
  const { result, sync } = fixture([])
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual([])
  expect(sync).not.toHaveBeenCalled()
})

it('migrates custom local bookmarks without requiring any default shortcut to remain', async () => {
  localStorage.setItem('browser-bookmarks', JSON.stringify(custom))
  const { result, sync } = fixture([], 'local')
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual(custom)
  await waitFor(() => expect(sync).toHaveBeenCalledExactlyOnceWith(custom))
})

it('preserves an intentionally empty local list on subsequent launches', async () => {
  localStorage.setItem('browser-bookmarks', '[]')
  const { result, sync } = fixture([], 'local')
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual([])
  expect(sync).not.toHaveBeenCalled()
})

it('adds legacy bookmarks missing from a populated local database without replacing existing titles', async () => {
  const stored = [{ url: 'https://existing.example', title: '数据库中的名称' }]
  localStorage.setItem('browser-bookmarks', JSON.stringify([{ ...stored[0], title: '旧缓存名称' }, ...custom]))
  const { result, sync } = fixture(stored, 'local')
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual([...stored, ...custom])
  await waitFor(() => expect(sync).toHaveBeenCalledExactlyOnceWith([...stored, ...custom]))
  await waitFor(() => expect(localStorage.getItem('browser-bookmarks-database-migrated-v1')).toBe('true'))
})

it('never resurrects deleted bookmarks from a stale cache after migration has completed', async () => {
  localStorage.setItem('browser-bookmarks', JSON.stringify(custom))
  localStorage.setItem('browser-bookmarks-database-migrated-v1', 'true')
  const { result, sync } = fixture([], 'local')
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  expect(result.current.bookmarks).toEqual([])
  expect(sync).not.toHaveBeenCalled()
})

it('saves a bookmark edit once and applies other-window updates without writing them back', async () => {
  const { result, sync, receive } = fixture(custom)
  await waitFor(() => expect(result.current.bookmarksReady).toBe(true))
  act(() => result.current.removeBookmark(custom[0].url))
  await waitFor(() => expect(sync).toHaveBeenCalledExactlyOnceWith([]))
  await act(async () => {})
  act(() => receive(custom))
  expect(result.current.bookmarks).toEqual(custom)
  expect(sync).toHaveBeenCalledOnce()
})

it('never writes bookmarks before initialization completes or after reading fails', async () => {
  const sync = vi.fn()
  let fail!: (error: Error) => void
  const pending = new Promise((_, reject) => { fail = reject })
  vi.stubGlobal('electronAPI', { getBrowserBookmarks: () => pending, syncBrowserBookmarks: sync, databaseSync: { status: async () => ({ source: 'remote' }) } })
  const { result } = renderHook(useBrowserBookmarks)
  act(() => result.current.setBookmarks(custom))
  expect(sync).not.toHaveBeenCalled()
  await act(async () => { fail(new Error('offline')) })
  expect(errors).toHaveBeenCalledWith('读取书签失败，请重试', expect.any(Object))
  expect(result.current.bookmarksReady).toBe(false)
  expect(sync).not.toHaveBeenCalled()
})
