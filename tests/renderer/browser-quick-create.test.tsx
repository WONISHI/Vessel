import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useBrowserPage } from '@/pages/browser/components/browser-page/hooks/use-browser-page'
import { newTab } from '@/pages/browser/components/index-shared'
import { browserTabAction } from '@/pages/browser/tab-state'
vi.mock('@vessel/react-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear() })
it('inserts a requested URL immediately after the current tab and activates it', () => {
 Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
  syncBrowserBookmarks: vi.fn(async () => {}), setBrowserDevtools: vi.fn(async () => {}),
  onBrowserNewTab: vi.fn(() => vi.fn()), onBrowserDevtoolsClosed: vi.fn(() => vi.fn())
 } })
 const page = renderHook(() => useBrowserPage(false))
 const first = newTab(), second = newTab(), third = newTab()
 act(() => { page.result.current.setTabs([first, second, third]); page.result.current.setActive(second.id) })
 act(() => browserTabAction('new', undefined, 'https://example.com/'))
 const tabs = page.result.current.tabs
 expect(tabs.map((tab) => tab.id)).toEqual([first.id, second.id, expect.any(String), third.id])
 expect(tabs[2].url).toBe('https://example.com/')
 expect(page.result.current.tab.id).toBe(tabs[2].id)
})
