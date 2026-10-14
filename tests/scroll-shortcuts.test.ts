// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { installScrollShortcuts } from '../src/renderer/src/lib/scroll-shortcuts'
import { matchesShortcut } from '../src/shared/shortcuts'
let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); document.body.replaceChildren() })
it('uses Control rather than Command for both scroll shortcuts', () => {
  expect(matchesShortcut({ key: 'A', ctrlKey: true, shiftKey: true }, 'scrollTop')).toBe(true)
  expect(matchesShortcut({ key: 'z', control: true, shift: true }, 'scrollBottom')).toBe(true)
  expect(matchesShortcut({ key: 'a', metaKey: true, shiftKey: true }, 'scrollTop')).toBe(false)
  expect(matchesShortcut({ key: 'z', ctrlKey: true }, 'scrollBottom')).toBe(false)
})
it('scrolls only the innermost hovered region even when another region has focus', () => {
  document.body.innerHTML = '<div data-vessel-scroll="area"><div data-radix-scroll-area-viewport id="outer"><div data-vessel-scroll="area"><div data-radix-scroll-area-viewport id="inner"><span id="content">content</span></div></div></div><button id="focus">focus</button></div>'
  const inner = document.getElementById('inner')!
  const outer = document.getElementById('outer')!
  const scroll = vi.fn(); inner.scrollTo = scroll; outer.scrollTo = vi.fn()
  Object.defineProperty(inner, 'scrollHeight', { value: 800 })
  document.getElementById('focus')!.focus()
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => document.getElementById('content') })
  dispose = installScrollShortcuts()
  document.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 20 }))
  const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, cancelable: true })
  window.dispatchEvent(event)
  expect(scroll).toHaveBeenCalledWith({ top: 800, behavior: 'smooth' })
  expect(outer.scrollTo).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(true)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true }))
  expect(scroll).toHaveBeenLastCalledWith({ top: 0, behavior: 'smooth' })
  dispose(); dispose = undefined
  scroll.mockClear()
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, shiftKey: true }))
  expect(scroll).not.toHaveBeenCalled()
})
