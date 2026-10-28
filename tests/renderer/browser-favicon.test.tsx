import { cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BrowserFavicon } from "@/components/browser-favicon"
import { pageObserverScript } from "@/pages/browser/page-observer"
afterEach(() => { cleanup(); document.head.querySelectorAll('link[rel]').forEach((el) => el.remove()); delete (window as any).__vesselPageObserver })
it("tries the site icon after a declared icon fails, then renders a globe", () => {
  const { container } = render(<BrowserFavicon url="https://example.com/page" favicon="https://example.com/broken.svg" />)
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')?.src).toBe('https://example.com/favicon.ico')
  fireEvent.error(container.querySelector('img')!)
  expect(container.querySelector('img')).toBeNull()
  expect(container.querySelector('svg')).not.toBeNull()
})
it("reports declared SVG icons without waiting for an Electron favicon event", () => {
  const report = vi.fn()
  ;(window as any).vesselPageBridge = { report }
  document.head.insertAdjacentHTML('beforeend', '<link rel="shortcut icon" href="https://example.com/logo.svg">')
  window.eval(pageObserverScript)
  expect(report).toHaveBeenCalledWith('favicon', 'https://example.com/logo.svg')
})
