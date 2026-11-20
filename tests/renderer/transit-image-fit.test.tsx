import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransitImageViewer } from '@/components/transit/file-preview/components/transit-image-viewer'

vi.mock('@/components/ui/image', () => ({ Image: ({ onZoomIn, onZoomOut, onToggleDetails, detailsHidden, resizable, ...props }: any) => <><img {...props} /><button onClick={onZoomIn}>放大</button><button onClick={onZoomOut}>缩小</button></> }))
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ viewportRef, children }: any) => <div ref={viewportRef}>{children}</div> }))
let resize: () => void
let width: number, height: number
beforeEach(() => {
  width = 632; height = 432
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: () => void) {}
    observe(element: HTMLElement) {
      Object.defineProperties(element, { clientWidth: { get: () => width }, clientHeight: { get: () => height } })
      resize = this.callback
      this.callback()
    }
    disconnect() {}
  })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function load(w: number, h: number) {
  const image = screen.getByRole('img', { hidden: true })
  Object.defineProperties(image, { naturalWidth: { value: w, configurable: true }, naturalHeight: { value: h, configurable: true } })
  fireEvent.load(image)
  return image.parentElement!
}
it.each([[1200, 600, 600], [600, 1200, 200], [200, 100, 200]])('fits %sx%s to the smaller width/height ratio', (w, h, expected) => {
  render(<TransitImageViewer src="data:image/png;base64,AAAA" name="photo" />)
  expect(load(w, h).style.width).toBe(`${expected}px`)
})
it('recalculates the fit on resize, permits zoom, and resets zoom for a new image', () => {
  const view = render(<TransitImageViewer src="first" name="photo" />)
  const canvas = load(1200, 600)
  expect(canvas.style.width).toBe('600px')
  act(() => { width = 332; resize() })
  expect(canvas.style.width).toBe('300px')
  fireEvent.click(screen.getByRole('button', { name: '放大' }))
  expect(canvas.style.width).toBe('375px')
  view.rerender(<TransitImageViewer src="second" name="photo" />)
  expect(load(1200, 600).style.width).toBe('300px')
})
