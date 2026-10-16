import { expect, it } from "vitest"
import { refineMatte, finishMatte } from "@vessel/utils/image/matte"

it("aligns a soft mask to a sharp image edge without blurring the source pixels", () => {
  const width = 40,
    height = 12
  const pixels = new Uint8ClampedArray(width * height * 4),
    mask = new Uint8ClampedArray(pixels.length)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4,
        color = x < 20 ? 240 : 20
      pixels.set([color, color, color, 255], i)
      mask[i + 3] = Math.round(Math.max(0, Math.min(1, (x - 15) / 10)) * 255)
    }
  const before = pixels.slice(),
    result = refineMatte(pixels, mask, width, height, 4),
    row = 6 * width
  expect(result[row + 19]).toBeLessThan(mask[(row + 19) * 4 + 3])
  expect(result[row + 20]).toBeGreaterThan(mask[(row + 20) * 4 + 3])
  expect(result[row]).toBe(0)
  expect(result[row + 39]).toBe(255)
  expect(pixels).toEqual(before)
})
it("keeps fractional alpha and has no tile seams", () => {
  const pixels = new Uint8ClampedArray(520 * 4 * 4).fill(100),
    mask = new Uint8ClampedArray(pixels.length).fill(128)
  const result = refineMatte(pixels, mask, 520, 4)
  expect([...new Set(result)]).toEqual([128])
})

it("feathers a hard contour into a gradual transition without blurring foreground texture", () => {
  const width = 60,
    height = 10,
    pixels = new Uint8ClampedArray(width * height * 4),
    alpha = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      alpha[p] = x < 30 ? 0 : 255
      pixels.set(x === 30 ? [90, 15, 15, 255] : [20 + (x % 2) * 30, 20, 20, 255], p * 4)
    }
  const before = pixels.slice(),
    result = finishMatte(pixels, alpha, width, height, 2, true)
  expect(result[29]).toBe(0)
  expect(result[30]).toBeLessThan(255)
  expect(result[28]).toBe(0)
  expect(result[29]).toBeLessThan(result[30])
  expect(pixels[30 * 4]).toBeLessThan(before[30 * 4])
  expect(pixels.slice(45 * 4, 55 * 4)).toEqual(before.slice(45 * 4, 55 * 4))
})
it("allows feathering and colour correction to be disabled", () => {
  const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 255]),
    before = pixels.slice()
  const alpha = new Uint8ClampedArray([0, 255])
  expect(finishMatte(pixels, alpha, 2, 1, 0, false)).toEqual(alpha)
  expect(pixels).toEqual(before)
})

it("does not grow opaque pixels or revive white transparent RGB into a halo at 4 px", () => {
  const width = 40,
    alpha = new Uint8ClampedArray(width),
    pixels = new Uint8ClampedArray(width * 4)
  for (let x = 0; x < width; x++) {
    alpha[x] = x < 20 ? 0 : 255
    pixels.set(x < 20 ? [255, 255, 255, 0] : [10, 10, 10, 255], x * 4)
  }
  const result = finishMatte(pixels, alpha, width, 1, 4, true)
  expect([...result.slice(0, 20)]).toEqual(new Array(20).fill(0))
  expect(result[22]).toBe(255)
  for (let i = 0; i < width; i++) expect(result[i]).toBeLessThanOrEqual(alpha[i])
  expect([...pixels.slice(28 * 4, 29 * 4)]).toEqual([10, 10, 10, 255])
})

it("suppresses weak matte shadows smoothly without changing the confident foreground", () => {
  const alpha = new Uint8ClampedArray([0, 10, 30, 50, 80, 110, 180, 255])
  const pixels = new Uint8ClampedArray(alpha.length * 4).fill(50)
  const result = finishMatte(pixels, alpha, alpha.length, 1, 0, false, 50)
  expect(result[1]).toBe(0)
  expect(result[2]).toBeLessThan(10)
  expect(result[3]).toBeLessThan(30)
  expect([...result.slice(5)]).toEqual([...alpha.slice(5)])
  for (let i = 1; i < result.length; i++) expect(result[i]).toBeGreaterThanOrEqual(result[i - 1])
})
