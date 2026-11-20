import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TransitImageViewer } from '@/components/transit/file-preview/components/transit-image-viewer'

vi.mock('@/components/ui/image', () => ({ Image: ({ onZoomIn, onZoomOut, onToggleDetails, detailsHidden, resizable, ...props }: any) => <><img {...props} /><button onClick={onZoomIn}>放大</button><button onClick={onZoomOut}>缩小</button><button onClick={onToggleDetails}>{detailsHidden ? "显示详情" : "隐藏详情"}</button></> }))
vi.mock('@/components/ui/scroll-area', () => ({ ScrollArea: ({ viewportRef, children }: any) => <div ref={viewportRef}>{children}</div> }))
let resize: () => void
let width: number, height: number
beforeEach(() => {
  width = 632; height = 432
  const callbacks = new Set<() => void>()
  resize = () => callbacks.forEach(callback => callback())
  vi.stubGlobal('ResizeObserver', class {
    constructor(private callback: () => void) {}
    observe(element: HTMLElement) {
      Object.defineProperties(element, { clientWidth: { get: () => width }, clientHeight: { get: () => height } })
      callbacks.add(this.callback)
      this.callback()
    }
    disconnect() { callbacks.delete(this.callback) }
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

it('uses the panel-owned details state after the viewer is remounted', () => {
  const onChange = vi.fn()
  const view = render(<TransitImageViewer src="photo" name="photo" detailsHidden={false} onDetailsHiddenChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: '隐藏详情' }))
  expect(onChange).toHaveBeenCalledWith(true)
  view.unmount()
  render(<TransitImageViewer src="photo" name="photo" detailsHidden onDetailsHiddenChange={onChange} />)
  expect(screen.queryByText('图片详细信息')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '显示详情' }))
  expect(onChange).toHaveBeenLastCalledWith(false)
})

it('automatically hides details in narrow previews while retaining explicit choices', () => {
  width = 420
  render(<TransitImageViewer src="responsive" name="photo" />)
  expect(screen.queryByText('图片详细信息')).toBeNull()
  act(() => { width = 800; resize() })
  expect(screen.getByText('图片详细信息')).toBeTruthy()
  act(() => { width = 420; resize() })
  expect(screen.queryByText('图片详细信息')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '显示详情' }))
  expect(screen.getByText('图片详细信息')).toBeTruthy()
  act(() => { width = 800; resize() })
  fireEvent.click(screen.getByRole('button', { name: '隐藏详情' }))
  act(() => { width = 420; resize(); width = 800; resize() })
  expect(screen.queryByText('图片详细信息')).toBeNull()
})
