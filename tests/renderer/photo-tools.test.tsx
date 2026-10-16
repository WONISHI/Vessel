import { expect, it } from 'vitest'
import { fitCrop, photoSizes, replaceBackground } from '../../src/renderer/src/pages/image-preview/photo-tools'

it('fits each photo ratio inside the image and keeps it while dragging in every direction', () => {
  expect(photoSizes.find(p => p.id === 'one')?.pixels).toEqual({ width: 295, height: 413 })
  expect(photoSizes.find(p => p.id === 'two')?.pixels).toEqual({ width: 413, height: 579 })
  for (const preset of photoSizes) {
    const ratio = preset.pixels.width / preset.pixels.height
    for (const region of [fitCrop({ width: 1000, height: 600 }, ratio), ...[{ x: 1200, y: 900 }, { x: 0, y: 900 }, { x: 1200, y: 0 }, { x: 0, y: 0 }].map(p => fitCrop({ width: 1000, height: 600 }, ratio, { x: 500, y: 300 }, p))]) {
      expect(region.width / region.height).toBeCloseTo(ratio)
      expect(region.x).toBeGreaterThanOrEqual(0)
      expect(region.y).toBeGreaterThanOrEqual(0)
      expect(region.x + region.width).toBeLessThanOrEqual(1000.00001)
      expect(region.y + region.height).toBeLessThanOrEqual(600.00001)
    }
  }
})
it('replaces a connected background while preserving an isolated matching foreground pixel', () => {
  const data = new Uint8ClampedArray(5 * 5 * 4).fill(255)
  for (let y = 1; y < 4; y++) for (let x = 1; x < 4; x++) if (!(x === 2 && y === 2)) data.set([0, 0, 0, 255], (y * 5 + x) * 4)
  replaceBackground(data, 5, 5, { x: 0, y: 0 }, '#ff0000', 0, 0)
  expect([...data.slice(0, 4)]).toEqual([255, 0, 0, 255])
  expect([...data.slice(48, 52)]).toEqual([255, 255, 255, 255])
  expect([...data.slice(24, 28)]).toEqual([0, 0, 0, 255])
})
it('fills transparency without changing an opaque subject', () => {
  const data = new Uint8ClampedArray([0, 0, 0, 0, 10, 20, 30, 255])
  replaceBackground(data, 2, 1, { x: 0, y: 0 }, '#ffffff', 0)
  expect([...data]).toEqual([255, 255, 255, 255, 10, 20, 30, 255])
})

it('removes old red backdrop from mixed hair edges and preserves interior pixels', () => {
  const data = new Uint8ClampedArray([
    200, 0, 0, 255, 200, 0, 0, 255, 110, 10, 10, 255, 20, 20, 20, 255, 20, 20, 20, 255, 20, 20, 20, 255
  ])
  replaceBackground(data, 6, 1, { x: 0, y: 0 }, '#0000c8', 0, 2)
  expect([...data.slice(0, 4)]).toEqual([0, 0, 200, 255])
  expect(data[8]).toBeLessThan(30)
  expect(data[10]).toBeGreaterThan(80)
  expect([...data.slice(20, 24)]).toEqual([20, 20, 20, 255])
})
