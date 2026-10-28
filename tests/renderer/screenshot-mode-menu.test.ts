import { expect, it, vi } from "vitest"
import { installScreenshotModes, updateScreenshotToolbar } from "@/features/screenshot/mode-menu"
it("selects OCR and translation without dispatching screenshot completion", () => {
  const heading = document.createElement('div')
  document.body.append(heading)
  const select = vi.fn()
  const dispose = installScreenshotModes(heading, select)
  const trigger = heading.querySelector('button')!
  expect(trigger.querySelector("svg")).not.toBeNull()
  trigger.click()
  expect(trigger.getAttribute('aria-expanded')).toBe('true')
  document.querySelector<HTMLButtonElement>('[data-mode="ocr"]')!.click()
  expect(select).toHaveBeenLastCalledWith('ocr')
  expect(trigger.textContent).toContain('OCR')
  expect(trigger.getAttribute('aria-expanded')).toBe('false')
  trigger.click()
  document.querySelector<HTMLButtonElement>('[data-mode="translate"]')!.click()
  expect(select).toHaveBeenLastCalledWith('translate')
  dispose()
  heading.remove()
  expect(document.querySelector('.shot-mode-menu')).toBeNull()
})

it("updates confirmation actions without changing the plugin command identity", () => {
  const toolbar = document.createElement("div")
  toolbar.innerHTML = '<div class="confirm" data-title="confirm"></div>'
  updateScreenshotToolbar(toolbar, "ocr")
  expect(toolbar.dataset.mode).toBe("ocr")
  expect(toolbar.querySelector(".confirm")?.getAttribute("aria-label")).toBe("提取文字")
  updateScreenshotToolbar(toolbar, "translate")
  expect(toolbar.querySelector(".confirm")?.getAttribute("aria-label")).toBe("翻译选区")
  expect(toolbar.querySelector<HTMLElement>(".confirm")?.dataset.title).toBe("confirm")
  updateScreenshotToolbar(toolbar, "copy")
  expect(toolbar.querySelector<HTMLElement>(".confirm")?.dataset.actionLabel).toBe("")
  delete document.body.dataset.screenshotMode
})
