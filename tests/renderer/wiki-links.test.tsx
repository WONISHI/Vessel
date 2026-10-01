import { expect, it } from "vitest"
import { parseWikiLinks, wikiLinkPath } from "../../packages/obsidian/src"
import { bindWikiLinkEditing, decorateWikiLinks } from "../../src/renderer/src/components/core/canvas/variants/markdown/decorate-wiki-links"
import { headingSections } from "../../src/renderer/src/components/core/canvas/variants/markdown/heading-sections"
it("parses root relative wiki links and excludes images, code and escaped links", () => {
  const source = '[[目录/文档|别名]] ![[photo.png]] `[[code]]` \\[[escaped]]\n```md\n[[hidden]]\n```\n[[next#heading]]'
  expect(parseWikiLinks(source).map(link => link.target)).toEqual(["目录/文档", "next"])
  expect(parseWikiLinks(source)[0].label).toBe("别名")
  expect(wikiLinkPath("目录/文档")).toBe("目录/文档.md")
  expect(() => wikiLinkPath("../secret")).toThrow()
  expect(() => wikiLinkPath("C:\\secret")).toThrow()
})
it("preserves editor source and does not duplicate wrappers", () => {
  const root = document.createElement("div")
  root.innerHTML = '<pre class="vditor-reset"><p>[[目录/文件]]</p><pre><code>[[code]]</code></pre></pre>'
  const before = root.textContent
  decorateWikiLinks(root)
  decorateWikiLinks(root)
  expect(root.textContent).toBe(before)
  expect(root.querySelectorAll("[data-wiki-target]")).toHaveLength(1)
  expect(root.querySelector("[data-wiki-target]")?.getAttribute("data-wiki-label")).toBe("文件")
})
it("includes descendant sections up to the next peer heading", () => {
  const sections = headingSections("# A\ntext\n## Child\nchild text\n# B\nother")
  expect(sections[0]).toContain("child text")
  expect(sections[0]).not.toContain("# B")
  expect(sections[1]).toBe("## Child\nchild text\n")
})

it("expands source for an interior caret and collapses after selection leaves", () => {
  const root = document.createElement("div")
  root.tabIndex = 0
  root.setAttribute("contenteditable", "true")
  root.textContent = "[[目录/面试题|面试题]] tail"
  document.body.append(root)
  decorateWikiLinks(root)
  const dispose = bindWikiLinkEditing(root)
  root.focus()
  const link = root.querySelector<HTMLElement>("[data-wiki-target]")!
  const range = document.createRange()
  range.setStart(link.firstChild!, 5)
  range.collapse(true)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event("selectionchange"))
  expect(link.classList.contains("vessel-wiki-editing")).toBe(true)
  expect(selection.anchorOffset).toBe(5)
  expect(link.textContent).toBe("[[目录/面试题|面试题]]")
  range.setStart(root.lastChild!, 2)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event("selectionchange"))
  expect(link.classList.contains("vessel-wiki-editing")).toBe(false)
  dispose()
  root.remove()
})

it("places the caret after a trailing wiki link when clicking its right-hand blank space", () => {
  const root = document.createElement("div")
  root.tabIndex = 0
  root.setAttribute("contenteditable", "true")
  root.innerHTML = "<p>[[系统集成化工程师]]</p>"
  document.body.append(root)
  decorateWikiLinks(root)
  const dispose = bindWikiLinkEditing(root)
  const link = root.querySelector<HTMLElement>("[data-wiki-target]")!
  link.getClientRects = () => [new DOMRect(20, 20, 100, 20)] as unknown as DOMRectList
  const line = root.firstElementChild!
  line.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX: 140, clientY: 30 }))
  const selection = window.getSelection()!
  expect(selection.anchorNode).toBe(line)
  expect(selection.anchorOffset).toBe(Array.from(line.childNodes).indexOf(link) + 1)
  expect(link.classList.contains("vessel-wiki-editing")).toBe(false)
  expect(root.textContent).toBe("[[系统集成化工程师]]")
  dispose()
  root.remove()
})
