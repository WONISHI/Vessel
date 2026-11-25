import { expect, it, vi } from "vitest"
import { FastAverageColor } from "fast-average-color"
import { DEFAULT_SITE_COLOR, effectiveSiteColor, faviconColor } from "@/pages/browser/favicon-color"

it("extracts the dominant logo color and falls back for missing, invalid or fully transparent icons", async () => {
  const extract = vi.spyOn(FastAverageColor.prototype, "getColorAsync")
  expect(await faviconColor()).toBe(DEFAULT_SITE_COLOR)
  expect(extract).not.toHaveBeenCalled()
  extract.mockResolvedValueOnce({ hex: "#4792f1", value: [71, 146, 241, 255] } as any)
  expect(await faviconColor("blue-icon")).toBe("#4792f1")
  expect(extract).toHaveBeenCalledWith("blue-icon", expect.objectContaining({ algorithm: "dominant" }))
  extract.mockRejectedValueOnce(new Error("decode failed"))
  expect(await faviconColor("broken-icon")).toBe(DEFAULT_SITE_COLOR)
  extract.mockResolvedValueOnce({ hex: "#000000", value: [0, 0, 0, 0] } as any)
  expect(await faviconColor("transparent-icon")).toBe(DEFAULT_SITE_COLOR)
})


it("ignores transparent pixels even when they outnumber the visible logo", async () => {
  const extractor = new FastAverageColor()
  const pixels = new Uint8ClampedArray(400)
  pixels.set([71, 146, 241, 255], 396)
  const spy = vi.spyOn(FastAverageColor.prototype, "getColorAsync").mockImplementation(async (_source, options) => {
    const value = extractor.getColorFromArray4(pixels, options)
    return { value, hex: "#4792f1" } as any
  })
  expect(await faviconColor("transparent-logo")).toBe("#4792f1")
  expect(spy).toHaveBeenCalledWith("transparent-logo", expect.objectContaining({ ignoredColor: expect.arrayContaining([[0, 0, 0, 0, 32], [255, 255, 255, 255, 24]]) }))
})


it.each([[255, 255, 255], [245, 244, 243], [128, 128, 128], [0, 0, 0]])("ignores dominant neutral backgrounds %j and keeps the orange logo", async (r, g, b) => {
  const extractor = new FastAverageColor()
  const pixels = new Uint8ClampedArray(400)
  for (let i = 0; i < 396; i += 4) pixels.set([r, g, b, 255], i)
  pixels.set([252, 109, 38, 255], 396)
  vi.spyOn(FastAverageColor.prototype, "getColorAsync").mockImplementation(async (_source, options) => {
    const value = extractor.getColorFromArray4(pixels, options)
    expect(value).toEqual([252, 109, 38, 255])
    return { value, hex: "#fc6d26" } as any
  })
  expect(await faviconColor("orange-logo")).toBe("#fc6d26")
})

it("falls back to green when all pixels are white", async () => {
  const extractor = new FastAverageColor()
  vi.spyOn(FastAverageColor.prototype, "getColorAsync").mockImplementation(async (_source, options) => {
    const value = extractor.getColorFromArray4(new Uint8ClampedArray([255, 255, 255, 255]), options)
    return { value, hex: "#000000" } as any
  })
  expect(await faviconColor("white-only")).toBe(DEFAULT_SITE_COLOR)
})

it.each(["#ffffff", "#f8f9fa", "#eeeeee", "#808080", "#000000", "white", undefined])("rejects stale neutral menu color %s", color => {
  expect(effectiveSiteColor(color)).toBe(DEFAULT_SITE_COLOR)
})
it("retains chromatic Google blue", () => {
  expect(effectiveSiteColor("#4285f4")).toBe("#4285f4")
})
