import { afterEach, expect, it, vi } from "vitest"
import { bindImageParagraphs, focusImageParagraph, insertImageMarkdown } from "@/components/core/canvas/variants/markdown/image-paragraph"

let unbind: (() => void) | undefined
afterEach(() => { unbind?.(); unbind = undefined; document.body.innerHTML = ""; window.getSelection()?.removeAllRanges(); vi.restoreAllMocks() })

/** Builds a document with an image followed by quoted text and a native-insert stand-in. */
function fixture() {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<div class="vessel-image-block"><pre><code>encoded-image-source</code></pre><div contenteditable="false"><img src="image.png"></div></div><blockquote><p>后面的正文</p></blockquote>'
  document.body.append(root)
  unbind = bindImageParagraphs(root)
  return { root }
}
it("Enter at the start of text after an image inserts a blank paragraph without changing image source", () => {
  const { root } = fixture()
  const text = root.querySelector("blockquote p")!.firstChild!
  const range = document.createRange(); range.setStart(text, 0); range.collapse(true)
  window.getSelection()!.addRange(range)
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
  text.parentElement!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(root.children[1].tagName).toBe("P")
  expect(root.querySelector("code")!.textContent).toBe("encoded-image-source")
  expect(root.querySelector("blockquote")!.textContent).toBe("后面的正文")
  expect(window.getSelection()!.anchorNode).toBe(root.children[1])
})
it("keeps Enter in ordinary text and IME input untouched", () => {
  const { root } = fixture()
  const text = root.querySelector("blockquote p")!.firstChild!
  const range = document.createRange(); range.setStart(text, 2); range.collapse(true)
  window.getSelection()!.addRange(range)
  text.parentElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
  range.setStart(text, 0); range.collapse(true)
  window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
  text.parentElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }))
  expect(root.querySelectorAll("p")).toHaveLength(1)
})

it("focuses an existing empty line directly below the image without inserting another paragraph", () => {
  const { root } = fixture()
  const image = root.firstElementChild as HTMLElement
  const paragraph = document.createElement("p")
  paragraph.innerHTML = "<br>"
  image.after(paragraph)
  expect(focusImageParagraph(image, true)).toBe(paragraph)
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
  expect(window.getSelection()?.anchorOffset).toBe(0)
})

it("focuses an existing empty line directly above the image without inserting another paragraph", () => {
  const { root } = fixture()
  const image = root.firstElementChild as HTMLElement
  const paragraph = document.createElement("p")
  paragraph.innerHTML = "<br>"
  image.before(paragraph)
  expect(focusImageParagraph(image, false)).toBe(paragraph)
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
  expect(window.getSelection()?.anchorOffset).toBe(0)
})

it("creates and focuses a new empty line when the line next to the image is not empty", () => {
  const { root } = fixture()
  const image = root.firstElementChild as HTMLElement
  const paragraph = document.createElement("p")
  paragraph.textContent = "下一行"
  image.after(paragraph)
  const created = focusImageParagraph(image, true)
  expect(created).not.toBe(paragraph)
  expect(created?.tagName).toBe("P")
  expect(image.nextElementSibling).toBe(created)
  expect(created?.nextElementSibling).toBe(paragraph)
  expect(window.getSelection()?.anchorNode).toBe(created)
})

it("creates and focuses an empty line when the image is followed by another block", () => {
  const { root } = fixture()
  const image = root.firstElementChild as HTMLElement
  const paragraph = focusImageParagraph(image)
  expect(paragraph?.tagName).toBe("P")
  expect(image.nextElementSibling).toBe(paragraph)
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
})

it("consumes the empty focus line when pasting another image beneath it", () => {
  const { root } = fixture()
  const first = root.querySelector<HTMLElement>(".vessel-image-block")!
  const paragraph = focusImageParagraph(first)!
  insertImageMarkdown(root, () => {
    const image = document.createElement("div")
    image.dataset.type = "code-block"
    image.className = "vessel-image-block"
    paragraph.after(image)
  })
  expect(root.querySelector("p[data-block]")).toBeNull()
  expect(first.nextElementSibling?.classList.contains("vessel-image-block")).toBe(true)
  expect(root.querySelector("blockquote")?.textContent).toBe("后面的正文")
})

it("preserves text entered on the focused line before pasting an image", () => {
  const { root } = fixture()
  const paragraph = focusImageParagraph(root.querySelector<HTMLElement>(".vessel-image-block")!)!
  paragraph.textContent = "保留文字"
  insertImageMarkdown(root, () => {
    const image = document.createElement("div"); image.dataset.type = "code-block"; paragraph.after(image)
  })
  expect(paragraph.isConnected).toBe(true)
  expect(paragraph.textContent).toBe("保留文字")
})

it.each(["h1", "h2", "h3", "h4", "h5", "h6"])("consumes only the insertion paragraph after a %s when pasting an image", (heading) => {
  const { root } = fixture()
  root.innerHTML = `<${heading}>算术运算符</${heading}><p data-keep><br></p><p data-insert><br></p><p>保留后文</p>`
  const paragraph = root.querySelector<HTMLElement>("[data-insert]")!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  window.getSelection()!.addRange(range)
  insertImageMarkdown(root, () => {
    const image = document.createElement("div")
    image.dataset.type = "code-block"
    image.className = "vessel-image-block"
    paragraph.after(image)
  })
  expect(root.querySelector("[data-insert]")).toBeNull()
  expect(root.querySelector("[data-keep]")).toBeTruthy()
  expect(root.querySelector(heading)?.textContent).toBe("算术运算符")
  expect(root.lastElementChild?.textContent).toBe("保留后文")
})

it("does not delete the insertion paragraph if image insertion fails before an existing block", () => {
  const { root } = fixture()
  root.innerHTML = '<h2>标题</h2><p><br></p><div class="vessel-image-block"></div>'
  const paragraph = root.querySelector("p")!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  window.getSelection()!.addRange(range)
  insertImageMarkdown(root, () => {})
  expect(paragraph.isConnected).toBe(true)
})

it.each(["ul", "ol"])("consumes the empty insertion line after %s even when rendering replaces the paragraph", (list) => {
  const { root } = fixture()
  root.innerHTML = `<${list}><li>算术运算符一览</li></${list}><p data-insert><br></p><p>保留后文</p>`
  const paragraph = root.querySelector("[data-insert]")!
  const range = document.createRange()
  range.selectNodeContents(paragraph)
  range.collapse(true)
  window.getSelection()!.addRange(range)
  insertImageMarkdown(root, () => {
    root.innerHTML = `<${list}><li>算术运算符一览</li></${list}><p data-insert><br></p><div class="vessel-image-block" data-type="code-block"></div><p>保留后文</p>`
  })
  expect(root.querySelector("[data-insert]")).toBeNull()
  expect(root.querySelector(list)?.textContent).toBe("算术运算符一览")
  expect(root.querySelector(list)?.nextElementSibling?.classList.contains("vessel-image-block")).toBe(true)
  expect(root.lastElementChild?.textContent).toBe("保留后文")
})

it("consumes a list-adjacent insertion paragraph when the caret sits at its parent boundary", () => {
  const { root } = fixture()
  root.innerHTML = '<ul><li>列表内容</li></ul><p data-insert><br></p>'
  const paragraph = root.querySelector("p")!
  const range = document.createRange()
  range.setStart(root, 1)
  range.collapse(true)
  window.getSelection()!.addRange(range)
  insertImageMarkdown(root, () => {
    const image = document.createElement("div")
    image.className = "vessel-image-block"
    paragraph.after(image)
  })
  expect(root.querySelector("[data-insert]")).toBeNull()
  expect(root.firstElementChild?.tagName).toBe("UL")
})
