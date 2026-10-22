import { expect, it, vi } from "vitest"
vi.mock("@resources/vendor/darkreader/darkreader.js?raw", () => ({ default: "window.installs = (window.installs || 0) + 1; exports.setFetchMethod = () => {}; exports.enable = (options) => { window.palette = options; window.enabled = true; }; exports.disable = () => { window.enabled = false; };" }))
import { guestAppearanceScript } from "@/pages/browser/guest-appearance"
it("switches a loaded page dark, light, and dark again without reinstalling or touching site globals", () => {
  const page: any = { fetch: vi.fn(), DarkReader: { siteOwned: true } }
  const apply = (dark: boolean) => new Function("window", guestAppearanceScript(dark))(page)
  apply(false)
  apply(true)
  expect(document.documentElement.dataset.vesselGuestTheme).toBe("dark")
  expect(page.enabled).toBe(true)
  expect(page.palette.darkSchemeBackgroundColor).toBe("#22272E")
  apply(false)
  expect(document.documentElement.dataset.vesselGuestTheme).toBe("light")
  expect(page.enabled).toBe(false)
  apply(true)
  expect(page.enabled).toBe(true)
  expect(page.installs).toBe(1)
  expect(page.DarkReader).toEqual({ siteOwned: true })
})
