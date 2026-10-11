import { expect, it, vi } from 'vitest'
import { JSDOM } from 'jsdom'
import { pageObserverScript } from '../../src/renderer/src/pages/browser/page-observer'
it('reports focus, defers search to the page, and asks before history navigation', () => {
  const dom = new JSDOM('<input/><div contenteditable="true"></div>', { url: 'https://example.com/', runScripts: 'outside-only' })
  const w = dom.window
  const report = vi.fn(), navigate = vi.fn(() => false), tasks: Function[] = []
  Object.assign(w, { vesselPageBridge: { report, navigate }, setTimeout: (fn: Function) => tasks.push(fn) })
  w.eval(pageObserverScript)
  w.document.querySelector('input')!.focus()
  expect(report).toHaveBeenLastCalledWith('focus', true)
  report.mockClear()
  const consume = (event: KeyboardEvent) => event.preventDefault()
  w.document.addEventListener('keydown', consume as never)
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }))
  tasks.splice(0).forEach(fn => fn())
  expect(report).toHaveBeenCalledWith('search-handled', true)
  expect(report).not.toHaveBeenCalledWith('find', true)
  w.document.removeEventListener('keydown', consume as never)
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'f', metaKey: true, bubbles: true, cancelable: true }))
  tasks.splice(0).forEach(fn => fn())
  expect(report).toHaveBeenCalledWith('find', true)
  w.history.pushState({}, '', '/blocked')
  expect(w.location.pathname).toBe('/')
  navigate.mockReturnValue(true)
  w.history.pushState({ test: 1 }, '', '/allowed')
  expect(w.location.pathname).toBe('/allowed')
  expect(w.history.state).toEqual({ test: 1 })
  w.eval(pageObserverScript)
  navigate.mockClear()
  w.history.replaceState({}, '', '/other')
  expect(navigate).toHaveBeenCalledTimes(1)
  dom.window.close()
})
