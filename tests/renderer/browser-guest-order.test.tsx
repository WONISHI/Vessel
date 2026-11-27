import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BrowserGuestViews } from '@/pages/browser/components/browser-page/browser-guest-views'
import { newTab } from '@/pages/browser/components/index-shared'

// A webview disconnect destroys its Electron guest even if React reuses its key.
vi.mock('@/pages/browser/components/guest', () => ({ Guest: ({ tab, visible }: { tab: { id: string }; visible: boolean }) => <div data-testid={tab.id} hidden={!visible}><input aria-label={`draft ${tab.id}`} defaultValue="" /></div> }))
afterEach(cleanup)

const tab = (id: string) => ({ ...newTab(), id, url: `https://${id}.example.com` })
const model = (allTabs: ReturnType<typeof tab>[]): ComponentProps<typeof BrowserGuestViews>['b'] => ({
  allTabs, activatedTabs: new Set(allTabs.map(item => item.id)), privateWindow: null,
  tab: allTabs[0], registerView: vi.fn(), update: vi.fn()
})

it('never moves mounted guest DOM nodes when tabs are reordered in either direction', () => {
  const a = tab('a'), b = tab('b'), c = tab('c'), state = model([a, b, c])
  const { container, rerender } = render(<BrowserGuestViews b={state} visible />)
  const nodes = [screen.getByTestId('a'), screen.getByTestId('b'), screen.getByTestId('c')]
  const input = screen.getByLabelText('draft b') as HTMLInputElement
  input.value = 'unsaved form state'
  const observer = new MutationObserver(() => {})
  observer.observe(container, { childList: true, subtree: true })
  for (const order of [[c, a, b], [b, c, a], [a, b, c]]) {
    rerender(<BrowserGuestViews b={{ ...state, allTabs: order }} visible />)
    expect([...container.children]).toEqual(nodes)
    expect(observer.takeRecords().flatMap(record => [...record.removedNodes])).toEqual([])
    expect(screen.getByLabelText('draft b')).toBe(input)
    expect(input.value).toBe('unsaved form state')
  }
  observer.disconnect()
})

it('adds, closes and freezes tabs while preserving other guest nodes and active visibility', () => {
  const b = tab('b'), c = tab('c'), a = tab('a'), state = model([b, c])
  const { container, rerender } = render(<BrowserGuestViews b={state} visible />)
  const original = screen.getByTestId('b'), other = screen.getByTestId('c')
  const observer = new MutationObserver(() => {})
  observer.observe(container, { childList: true, subtree: true })
  rerender(<BrowserGuestViews b={{ ...state, allTabs: [b, a, c], activatedTabs: new Set(['a', 'b', 'c']) }} visible />)
  expect(observer.takeRecords().flatMap(record => [...record.removedNodes])).toEqual([])
  expect(screen.getByTestId('b')).toBe(original)
  rerender(<BrowserGuestViews b={{ ...state, allTabs: [c, { ...b, frozen: true }], tab: c }} visible />)
  expect(screen.queryByTestId('a')).toBeNull()
  expect(screen.queryByTestId('b')).toBeNull()
  expect(screen.getByTestId('c')).toBe(other)
  expect(other.hidden).toBe(false)
  observer.disconnect()
})
