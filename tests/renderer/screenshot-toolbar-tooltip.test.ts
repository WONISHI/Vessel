import { expect, it, vi } from "vitest"
import { installToolbarTooltip } from "@/features/screenshot/toolbar-tooltip"
it("shows a custom function hint without changing screenshot command keys and hides on interaction", () => {
  vi.useFakeTimers()
  document.body.innerHTML = '<div id="toolPanel"><div class="item-panel" data-title="text"><span class="text"></span></div><div class="item-panel" data-title="confirm"><span class="confirm" aria-label="翻译选区"></span></div></div>'
  const toolbar = document.getElementById("toolPanel")!
  const dispose = installToolbarTooltip(toolbar)
  const text = toolbar.querySelector(".text")!
  text.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  vi.advanceTimersByTime(180)
  const tip = document.querySelector<HTMLElement>('[role="tooltip"]')!
  expect(tip.hidden).toBe(false)
  expect(tip.textContent).toBe("文字")
  expect(text.parentElement!.dataset.title).toBe("text")
  toolbar.querySelector(".confirm")!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }))
  vi.advanceTimersByTime(180)
  expect(tip.textContent).toBe("翻译选区")
  expect(toolbar.lastElementChild!.getAttribute("data-title")).toBe("confirm")
  toolbar.dispatchEvent(new Event("pointerdown", { bubbles: true }))
  expect(tip.hidden).toBe(true)
  dispose()
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
  vi.useRealTimers()
  document.body.innerHTML = ""
})
