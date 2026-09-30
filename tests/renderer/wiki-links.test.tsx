import { expect, it } from "vitest"
import { parseWikiLinks, wikiLinkPath } from "../../packages/obsidian/src"
import { decorateWikiLinks } from "../../src/renderer/src/components/core/canvas/variants/markdown/decorate-wiki-links"
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
  root.innerHTML = '<p>[[目录/文件]]</p><pre><code>[[code]]</code></pre>'
  const before = root.textContent
  decorateWikiLinks(root)
  decorateWikiLinks(root)
  expect(root.textContent).toBe(before)
  expect(root.querySelectorAll("[data-wiki-target]")).toHaveLength(1)
})
it("includes descendant sections up to the next peer heading", () => {
  const sections = headingSections("# A\ntext\n## Child\nchild text\n# B\nother")
  expect(sections[0]).toContain("child text")
  expect(sections[0]).not.toContain("# B")
  expect(sections[1]).toBe("## Child\nchild text\n")
})
