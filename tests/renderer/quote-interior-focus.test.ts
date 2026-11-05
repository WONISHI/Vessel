import { createRequire } from "node:module"
import { afterEach, expect, it } from "vitest"
import { decorateCallouts } from "@/components/core/canvas/variants/markdown/callouts"
import { focusImageParagraph, focusInsideQuote, isEmptyParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"

createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()

afterEach(() => {
  document.body.replaceChildren()
  window.getSelection()?.removeAllRanges()
})

it("nested image-encoded block 聚焦 keeps empty paragraph inside the callout", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  const encoded = encodeURIComponent("![[a.png]]")
  root.innerHTML = lute.Md2VditorIRDOM(`> [!note] t\n> \`\`\`vessel-obsidian-image\n> ${encoded}\n> \`\`\`\n`)
  document.body.append(root)
  decorateCallouts(root)
  const quote = root.querySelector<HTMLElement>("blockquote.vessel-callout, blockquote")!
  const block = quote.querySelector<HTMLElement>('[data-type="code-block"]')!
  expect(block).toBeTruthy()
  const below = focusImageParagraph(block, true)!
  expect(isEmptyParagraph(below)).toBe(true)
  expect(below.parentElement).toBe(quote)
  expect(block.nextElementSibling).toBe(below)
  expect(quote.contains(below)).toBe(true)
  expect(quote.nextElementSibling).not.toBe(below)

  const above = focusImageParagraph(block, false)!
  expect(isEmptyParagraph(above)).toBe(true)
  expect(above.parentElement).toBe(quote)
  expect(block.previousElementSibling).toBe(above)
})

it("focusInsideQuote does not create a sibling outside the 标注", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("前文\n\n> [!tip] 标\n> 内容\n\n后文\n")
  document.body.append(root)
  decorateCallouts(root)
  const quote = root.querySelector<HTMLElement>(".vessel-callout")!
  const before = [...root.children]
  focusInsideQuote(quote, true)
  focusInsideQuote(quote, false)
  // Outside siblings of the quote stay the same elements (no new outside empty line).
  expect(quote.previousElementSibling).toBe(before[before.indexOf(quote) - 1] ?? null)
  expect(quote.nextElementSibling).toBe(before[before.indexOf(quote) + 1] ?? null)
  expect(quote.firstElementChild && isEmptyParagraph(quote.firstElementChild)).toBe(true)
  expect(quote.lastElementChild && isEmptyParagraph(quote.lastElementChild)).toBe(true)
})

it("callout 上下方聚焦创建外部空行，复用已有空行并保持标注内容", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("> [!help]+ 结果是2，3，4\n> 标注内容\n")
  document.body.append(root)
  decorateCallouts(root)
  const quote = root.querySelector<HTMLElement>("blockquote")!
  const original = quote.innerHTML
  for (const below of [false, true]) {
    const paragraph = focusImageParagraph(quote, below)!
    expect(paragraph.parentElement).toBe(root)
    expect(below ? quote.nextElementSibling : quote.previousElementSibling).toBe(paragraph)
    expect(isEmptyParagraph(paragraph)).toBe(true)
    expect(window.getSelection()?.anchorNode === paragraph || paragraph.contains(window.getSelection()?.anchorNode || null)).toBe(true)
    expect(focusImageParagraph(quote, below)).toBe(paragraph)
  }
  expect(quote.innerHTML).toBe(original)
})
