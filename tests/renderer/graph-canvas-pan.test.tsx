import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { GraphCanvas } from '@/components/workspace/graph/graph-canvas'
import { defaultGraphSettings } from '@vessel/workspace'
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('pans with the middle mouse button even over a node and keeps left click for opening it', () => {
 let frame!: FrameRequestCallback
 const messages = vi.fn()
 let receive!: (event: { data: unknown }) => void
 vi.stubGlobal('Worker', class {
  set onmessage(callback: typeof receive) { receive = callback }
  postMessage = messages
  terminate = vi.fn()
 })
 vi.stubGlobal('PointerEvent', class extends MouseEvent { pointerId = 1; pointerType = 'mouse' })
 vi.stubGlobal('ResizeObserver', class { constructor(private callback: () => void) {} observe() { this.callback() } disconnect() {} })
 vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frame = callback; return 1 })
 vi.stubGlobal('cancelAnimationFrame', vi.fn())
 const context = Object.fromEntries(['setTransform', 'clearRect', 'translate', 'scale', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'arc', 'fill', 'fillText'].map(key => [key, vi.fn()]))
 vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
 vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, toJSON() {} })
 HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
 HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false)
 const node = { id: 'a.md', path: 'a.md', label: 'A', kind: 'note' as const, tags: [] }
 const open = vi.fn()
 const rendered = render(<GraphCanvas graph={{ nodes: [node], edges: [], warnings: [], stats: { files: 1, scanned: 1, reused: 0, elapsedMs: 0 } }} settings={defaultGraphSettings} onOpen={open} onLocal={vi.fn()} onReveal={vi.fn()} />)
 act(() => receive({ data: { generation: 1, positions: new Float32Array([0, 0]) } }))
 const canvas = screen.getByRole('img')
 fireEvent.pointerDown(canvas, { button: 1, clientX: 100, clientY: 100 })
 expect(canvas.style.cursor).toBe('grabbing')
 fireEvent.pointerMove(canvas, { clientX: 130, clientY: 140 })
 fireEvent.pointerUp(canvas, { button: 1, clientX: 130, clientY: 140 })
 act(() => frame(100))
 expect(context.translate).toHaveBeenLastCalledWith(130, 140)
 expect(open).not.toHaveBeenCalled()
 expect(messages.mock.calls.some(([message]) => message.type === 'drag')).toBe(false)
 expect(canvas.style.cursor).toBe('')
 const beforeZoom = context.scale.mock.calls.at(-1)![0]
 const zoomIn = new WheelEvent('wheel', { deltaY: -3, deltaMode: 1, clientX: 130, clientY: 140, bubbles: true, cancelable: true })
 fireEvent(canvas, zoomIn)
 expect(zoomIn.defaultPrevented).toBe(true)
 act(() => frame(200))
 expect(context.scale.mock.calls.at(-1)![0]).toBeGreaterThan(beforeZoom)
 fireEvent.wheel(canvas, { deltaY: 3, deltaMode: 1, clientX: 130, clientY: 140 })
 act(() => frame(300))
 expect(context.scale.mock.calls.at(-1)![0]).toBeCloseTo(beforeZoom)

 fireEvent.pointerDown(canvas, { button: 0, clientX: 130, clientY: 140 })
 fireEvent.pointerUp(canvas, { button: 0, clientX: 130, clientY: 140 })
 expect(open).toHaveBeenCalledWith(node)
 // A fully settled large graph may already fit below the old 2% zoom limit.
 const nodes = [node, { ...node, id: 'b.md', path: 'b.md', label: 'B' }]
 rendered.rerender(<GraphCanvas graph={{ nodes, edges: [], warnings: [], stats: { files: 2, scanned: 2, reused: 0, elapsedMs: 0 } }} settings={defaultGraphSettings} onOpen={open} onLocal={vi.fn()} onReveal={vi.fn()} />)
 fireEvent.click(screen.getByLabelText('适应画布'))
 act(() => receive({ data: { generation: 2, positions: new Float32Array([-10000, 0, 10000, 0]) } }))
 act(() => frame(400))
 const fittedScale = context.scale.mock.calls.at(-1)![0]
 expect(fittedScale).toBeLessThan(0.02)
 fireEvent.click(screen.getByLabelText('缩小图谱'))
 act(() => frame(500))
 expect(context.scale.mock.calls.at(-1)![0]).toBeCloseTo(fittedScale / 1.2)
 expect(context.scale.mock.calls.at(-1)![0]).toBeLessThan(fittedScale)

})
