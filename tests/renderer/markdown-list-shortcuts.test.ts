import { afterEach, expect, it, vi } from "vitest"
import { bindListShortcuts } from "@/components/core/canvas/variants/markdown/list-shortcuts"
let unbind: (() => void) | undefined
afterEach(() => { unbind?.(); document.body.innerHTML = ""; window.getSelection()?.removeAllRanges() })

/** Places the caret after a marker in an editable fixture. */
function fixture(html: string) {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true"); root.innerHTML = html; document.body.append(root)
  unbind = bindListShortcuts(root)
  const node = root.querySelector("p")!.firstChild!
  const range = document.createRange(); range.selectNodeContents(node); range.collapse(false)
  window.getSelection()!.addRange(range)
  const command = vi.fn()
  Object.defineProperty(document, "execCommand", { configurable: true, value: command })
  return { root, command }
}
it.each(["-", "+", "*"])("converts the %s marker into a list as a single edit", (marker) => {
  const { root, command } = fixture(`<p>${marker}</p>`)
  const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true })
  root.querySelector("p")!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(command).toHaveBeenCalledWith("insertHTML", false, expect.stringContaining("<ul"))
})
it.each(['<pre><p>-</p></pre>', '<table><tr><td><p>-</p></td></tr></table>', '<p>some-text-</p>'])("preserves markers inside other editing contexts", (html) => {
  const { root, command } = fixture(html)
  root.querySelector("p")!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }))
  expect(command).not.toHaveBeenCalled()
})
it("does not transform an IME composition", () => {
  const { root, command } = fixture("<p>-</p>")
  root.querySelector("p")!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", isComposing: true, bubbles: true }))
  expect(command).not.toHaveBeenCalled()
})
