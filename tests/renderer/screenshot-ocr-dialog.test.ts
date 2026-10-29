import { expect, it } from "vitest"
import { createOcrDialog } from "@/features/screenshot/ocr-dialog"
it("builds the translation design with real controls and loading/error states", () => {
  const view = createOcrDialog(true)
  document.body.append(view.overlay)
  expect(view.panel.getAttribute("aria-label")).toBe("截图翻译")
  expect(view.panel.querySelectorAll("textarea")).toHaveLength(2)
  expect(view.copy.disabled).toBe(true)
  view.setBusy(true)
  expect(view.retry.textContent).toBe("翻译中…")
  expect(view.language.disabled).toBe(true)
  expect(view.text.readOnly).toBe(true)
  view.setStatus("翻译失败：连接超时", "error")
  expect(view.panel.querySelector('[role="status"]')?.getAttribute("data-state")).toBe("error")
  view.setBusy(false, true)
  expect(view.retry.textContent).toBe("重新翻译")
  view.translated.value = "旧译文"
  view.copy.disabled = false
  view.language.value = "en"
  view.language.dispatchEvent(new Event("change"))
  expect(view.panel.querySelector(".target .shot-dialog-tag")?.textContent).toBe("译文 · 英语")
  expect(view.translated.value).toBe("")
  expect(view.copy.disabled).toBe(true)
  view.overlay.remove()
})
