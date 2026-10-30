import { expect, it, vi } from "vitest"
import { installTextOptions, screenshotTextFont, drawScreenshotTextDecoration } from "@/features/screenshot/text-options"
it("expands text options and applies formatting to plugin text drawing", async () => {
  const toolbar = document.createElement("div")
  toolbar.innerHTML = '<span class="text-active"></span>'
  const panel = document.createElement("div")
  document.body.append(toolbar, panel)
  const dispose = installTextOptions(toolbar, panel)
  expect(panel.dataset.textOptions).toBe("true")
  const more = panel.querySelector<HTMLButtonElement>('[aria-label="展开文字选项"]')!
  more.click()
  expect(more.getAttribute("aria-expanded")).toBe("true")
  const family = panel.querySelector<HTMLDetailsElement>(".shot-font-picker")!
  family.open = true
  const serif = family.querySelectorAll<HTMLButtonElement>("button")[1]
  serif.click()
  expect(serif.getAttribute("aria-checked")).toBe("true")
  expect(family.open).toBe(false)
  expect(screenshotTextFont("17px none")).toContain("serif")
  family.querySelector<HTMLButtonElement>("button")!.click()
  const buttons = panel.querySelectorAll<HTMLButtonElement>(".shot-text-format:not(.shot-font-picker) .shot-text-format-menu button")
  buttons[0].click(); buttons[1].click(); buttons[2].click(); buttons[3].click()
  expect(screenshotTextFont("bold 17px none")).toContain("italic 700 17px")
  expect(screenshotTextFont('600 18px "Plus Jakarta Sans"')).toBe('600 18px "Plus Jakarta Sans"')
  const context = { font: screenshotTextFont("17px none"), fillStyle: "red", measureText: () => ({ width: 50 }), save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() }
  drawScreenshotTextDecoration(context as any, "文字", 10, 20)
  expect(context.lineTo).toHaveBeenCalledTimes(2)
  for (const button of buttons) button.click()
  dispose()
  expect(panel.children).toHaveLength(0)
  toolbar.remove(); panel.remove()
})
