import { afterEach, expect, it, vi } from "vitest"
import { bindMarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu-selection"
let unbind: (() => void) | undefined
afterEach(() => { unbind?.(); vi.useRealTimers(); document.body.innerHTML = ""; window.getSelection()?.removeAllRanges() })

/** Creates an IR paragraph and puts the caret immediately after its final character. */
function fixture(html: string) {
  vi.useFakeTimers()
  vi.setSystemTime(1000)
  const root = document.createElement("div")
  root.innerHTML = `<div class="vditor-ir"><pre contenteditable="true">${html}</pre></div>`
  document.body.append(root)
  const paragraph = root.querySelector("p")!
  const text = paragraph.firstChild!
  const range = document.createRange()
  range.setStart(text, text.textContent!.length)
  range.collapse(true)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
  const open = vi.fn()
  const close = vi.fn()
  unbind = bindMarkdownInsertMenu(root, open, close)
  return { paragraph, open, close }
}
it("opens only for a standalone forward slash", () => {
  const { paragraph, open } = fixture("<p>/</p>")
  paragraph.dispatchEvent(new InputEvent("input", { data: "/", bubbles: true }))
  vi.advanceTimersByTime(40)
  expect(open).toHaveBeenCalledOnce()
  expect(open.mock.calls[0][0].range.toString()).toBe("/")
})
it.each(["<p>4. /</p>", "<p>文字/</p>", "<p>/文字</p>", "<ol><li><p>/</p></li></ol>", "<p>\\</p>", "<p>／</p>", "<p>、</p>"])("does not open in nonempty text, lists or for alternate slash characters: %s", (html) => {
  const { paragraph, open } = fixture(html)
  paragraph.dispatchEvent(new InputEvent("input", { data: paragraph.textContent!.slice(-1), bubbles: true }))
  // A physical Slash key code alone must not turn a backslash into a command.
  paragraph.dispatchEvent(new KeyboardEvent("keydown", { key: "\\", code: "Slash", bubbles: true }))
  vi.advanceTimersByTime(40)
  expect(open).not.toHaveBeenCalled()
})

it("closes the slash menu as soon as further text is entered", () => {
  const { paragraph, open, close } = fixture("<p>/</p>")
  paragraph.dispatchEvent(new InputEvent("input", { data: "/", bubbles: true }))
  vi.advanceTimersByTime(40)
  expect(open).toHaveBeenCalledOnce()
  paragraph.textContent = "/hello"
  paragraph.dispatchEvent(new InputEvent("input", { data: "o", bubbles: true }))
  expect(close).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(40)
  expect(open).toHaveBeenCalledOnce()
})
