import { afterEach, expect, it, vi } from "vitest"
import { bindImageParagraphs, focusImageParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"

let unbind: (() => void) | undefined
afterEach(() => { unbind?.(); unbind = undefined; document.body.innerHTML = ""; window.getSelection()?.removeAllRanges(); vi.restoreAllMocks() })

/** Builds a document with an image followed by quoted text and a native-insert stand-in. */
function fixture() {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<div class="vessel-image-block"><pre><code>encoded-image-source</code></pre><div contenteditable="false"><img src="image.png"></div></div><blockquote><p>后面的正文</p></blockquote>'
  document.body.append(root)
  unbind = bindImageParagraphs(root)
  const command = vi.fn(() => {
    const range = window.getSelection()!.getRangeAt(0)
    const paragraph = document.createElement("p")
    paragraph.innerHTML = "<br>"
    range.insertNode(paragraph)
    return true
  })
  Object.defineProperty(document, "execCommand", { configurable: true, value: command })
  return { root, command }
}
it("Enter at the start of text after an image inserts a blank paragraph without changing image source", () => {
  const { root, command } = fixture()
  const text = root.querySelector("blockquote p")!.firstChild!
  const range = document.createRange(); range.setStart(text, 0); range.collapse(true)
  window.getSelection()!.addRange(range)
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
  text.parentElement!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(command).toHaveBeenCalledWith("insertHTML", false, '<p data-block="0"><br></p>')
  expect(root.children[1].tagName).toBe("P")
  expect(root.querySelector("code")!.textContent).toBe("encoded-image-source")
  expect(root.querySelector("blockquote")!.textContent).toBe("后面的正文")
  expect(window.getSelection()!.anchorNode).toBe(root.children[1])
})
it("keeps Enter in ordinary text and IME input untouched", () => {
  const { root, command } = fixture()
  const text = root.querySelector("blockquote p")!.firstChild!
  const range = document.createRange(); range.setStart(text, 2); range.collapse(true)
  window.getSelection()!.addRange(range)
  text.parentElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  range.setStart(text, 0); range.collapse(true)
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  text.parentElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }))
  expect(command).not.toHaveBeenCalled()
})

it("focuses the line directly below the image without inserting another paragraph", () => {
  const { root, command } = fixture()
  const image = root.firstElementChild as HTMLElement
  const paragraph = document.createElement("p")
  paragraph.textContent = "下一行"
  image.after(paragraph)
  expect(focusImageParagraph(image)).toBe(paragraph)
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
  expect(window.getSelection()?.anchorOffset).toBe(0)
  expect(command).not.toHaveBeenCalled()
})
it("creates and focuses an empty line when the image is followed by another block", () => {
  const { root, command } = fixture()
  const paragraph = focusImageParagraph(root.firstElementChild as HTMLElement)
  expect(paragraph?.tagName).toBe("P")
  expect(command).toHaveBeenCalledOnce()
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
})
