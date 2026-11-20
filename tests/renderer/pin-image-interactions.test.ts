import { expect, it, vi } from 'vitest'
import { installPinImageInteractions, type PinDrag } from '@/features/screenshot/pin-image-interactions'

it('opens the pin menu on image right-click while retaining left drag and cancellation', () => {
 const image = document.createElement('img')
 const api = { pinMenu: vi.fn(async () => {}), pinDrag: vi.fn<(value: PinDrag) => Promise<void>>(async () => {}) }
 const error = vi.fn()
 image.setPointerCapture = vi.fn()
 image.hasPointerCapture = vi.fn(() => true)
 image.releasePointerCapture = vi.fn()
 installPinImageInteractions(image, api, error)
 const pointer = (type: string, button = 0) => {
  const event = new MouseEvent(type, { button, screenX: 50, screenY: 80, cancelable: true })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  image.dispatchEvent(event)
 }
 pointer('pointerdown', 2)
 const menu = new MouseEvent('contextmenu', { cancelable: true })
 image.dispatchEvent(menu)
 expect(menu.defaultPrevented).toBe(true)
 expect(api.pinMenu).toHaveBeenCalledOnce()
 expect(api.pinDrag).not.toHaveBeenCalled()
 pointer('pointerdown')
 expect(image.setPointerCapture).toHaveBeenCalledWith(1)
 pointer('pointermove')
 pointer('pointercancel')
 expect(api.pinDrag.mock.calls.map(([value]) => value.phase)).toEqual(['start', 'move', 'end'])
 pointer('pointermove')
 expect(api.pinDrag).toHaveBeenCalledTimes(3)
 expect(error).not.toHaveBeenCalled()
})
