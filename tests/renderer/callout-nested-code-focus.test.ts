import { createRequire } from "node:module"
import { afterEach, expect, it, vi } from "vitest"
import { bindCallouts, decorateCallouts } from "@/components/core/canvas/variants/markdown/callouts"
import { decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"
import { focusImageParagraph, focusInsideQuote, isEmptyParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"

createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()

afterEach(() => {
  document.body.replaceChildren()
  window.getSelection()?.removeAllRanges()
})

it("does not steal code-header contextmenu inside a callout (nested code keeps its own 聚焦)", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("> [!question] 标题\n> 说明\n>\n> ```python\n> print(1)\n> ```\n")
  document.body.append(root)
  decorateCallouts(root)
  decorateCodeBlocks(root)

  const blockMenu = vi.fn()
  const unbind = bindCallouts(root, undefined, blockMenu)
  const codeDetail = vi.fn()
  root.addEventListener("vessel-code-context-menu", ((event: CustomEvent) => codeDetail(event.detail)) as EventListener)

  const block = root.querySelector<HTMLElement>('[data-type="code-block"]')!
  const pre = block.querySelector<HTMLElement>("pre.vessel-code-frame, pre.vditor-ir__marker")!
  expect(pre).toBeTruthy()
  const rect = { left: 0, top: 100, right: 400, bottom: 300, width: 400, height: 200, x: 0, y: 100, toJSON() {} }
  vi.spyOn(pre, "getBoundingClientRect").mockReturnValue(rect as DOMRect)

  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 50, clientY: 110 })
  Object.defineProperty(event, "target", { value: pre.querySelector("code") || pre })
  pre.dispatchEvent(event)

  expect(blockMenu).not.toHaveBeenCalled()
  expect(codeDetail).toHaveBeenCalled()
  expect(codeDetail.mock.calls[0][0].block).toBe(block)
  unbind()
})

it("nested code 聚焦 inserts empty paragraph inside the callout, not in code and not outside the quote", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("> [!question] 标题\n> 说明\n>\n> ```python\n> print(1)\n> ```\n")
  document.body.append(root)
  decorateCallouts(root)
  decorateCodeBlocks(root)

  const quote = root.querySelector<HTMLElement>("blockquote.vessel-callout")!
  const block = quote.querySelector<HTMLElement>('[data-type="code-block"]')!
  const codeBefore = block.querySelector("pre.vditor-ir__marker code")!.textContent
  const outsideBefore = root.childElementCount

  const below = focusImageParagraph(block, true)!
  expect(isEmptyParagraph(below)).toBe(true)
  expect(below.parentElement).toBe(quote)
  expect(block.nextElementSibling).toBe(below)
  expect(block.querySelector("pre.vditor-ir__marker code")!.textContent).toBe(codeBefore)
  expect(quote.nextElementSibling).not.toBe(below)
  expect(root.childElementCount).toBe(outsideBefore)

  const above = focusImageParagraph(block, false)!
  expect(isEmptyParagraph(above)).toBe(true)
  expect(above.parentElement).toBe(quote)
  expect(block.previousElementSibling).toBe(above)
  expect(quote.contains(above)).toBe(true)
})

it("标注/callout 聚焦 inserts empty paragraph inside the quote, not outside", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("> [!note] 标题\n> 标注内容\n")
  document.body.append(root)
  decorateCallouts(root)

  const quote = root.querySelector<HTMLElement>("blockquote.vessel-callout")!
  const prevOutside = quote.previousElementSibling
  const nextOutside = quote.nextElementSibling

  const below = focusInsideQuote(quote, true)!
  expect(isEmptyParagraph(below)).toBe(true)
  expect(below.parentElement).toBe(quote)
  expect(quote.lastElementChild).toBe(below)
  expect(quote.previousElementSibling).toBe(prevOutside)
  expect(quote.nextElementSibling).toBe(nextOutside)

  const above = focusInsideQuote(quote, false)!
  expect(isEmptyParagraph(above)).toBe(true)
  expect(above.parentElement).toBe(quote)
  expect(quote.firstElementChild).toBe(above)
  expect(quote.previousElementSibling).toBe(prevOutside)
  expect(quote.nextElementSibling).toBe(nextOutside)
})

it("top-level code 聚焦 still inserts empty sibling outside the block", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("前文\n\n```python\nprint(1)\n```\n\n后文\n")
  document.body.append(root)
  decorateCodeBlocks(root)
  const block = root.querySelector<HTMLElement>('[data-type="code-block"]')!
  const below = focusImageParagraph(block, true)!
  expect(isEmptyParagraph(below)).toBe(true)
  expect(block.nextElementSibling).toBe(below)
  expect(below.closest("blockquote")).toBeNull()
})

it("still opens callout block menu when right-clicking callout body text", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("> [!question] 标题\n> 说明文字\n>\n> ```python\n> print(1)\n> ```\n")
  document.body.append(root)
  decorateCallouts(root)
  decorateCodeBlocks(root)
  const blockMenu = vi.fn()
  const unbind = bindCallouts(root, undefined, blockMenu)
  const body = [...root.querySelectorAll("p")].find((p) => (p.textContent || "").includes("说明"))!
  body.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }))
  expect(blockMenu).toHaveBeenCalled()
  unbind()
})
