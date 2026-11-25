import { expect, it, vi } from "vitest"
import { FastAverageColor } from "fast-average-color"
import { DEFAULT_SITE_COLOR, faviconColor } from "@/pages/browser/favicon-color"

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
