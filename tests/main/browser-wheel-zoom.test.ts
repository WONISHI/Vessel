import { expect, it, vi } from 'vitest'
import type { WebContents } from 'electron'
import { registerBrowserWheelZoom } from '@main/browser/browser-wheel-zoom'

it('zooms by 10% per wheel request, clamps the range and reports the actual factor', () => {
 let wheel!: (event: object, direction: 'in' | 'out') => void
 let factor = 1
 const send = vi.fn()
 const guest = {
  on: vi.fn((_event, callback) => { wheel = callback }),
  getZoomFactor: () => factor,
  setZoomFactor: vi.fn((value) => { factor = value }), send
 }
 registerBrowserWheelZoom(guest as unknown as WebContents)
 expect(guest.on).toHaveBeenCalledWith('zoom-changed', expect.any(Function))
 wheel({}, 'in')
 expect(factor).toBe(1.1)
 expect(send).toHaveBeenLastCalledWith('vessel:zoom-changed', 1.1)
 wheel({}, 'out')
 expect(factor).toBe(1)
 for (let i = 0; i < 30; i++) wheel({}, 'out')
 expect(factor).toBe(0.5)
 for (let i = 0; i < 30; i++) wheel({}, 'in')
 expect(factor).toBe(2)
 expect(send).toHaveBeenLastCalledWith('vessel:zoom-changed', 2)
})
