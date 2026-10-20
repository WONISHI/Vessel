import { afterEach, expect, it } from "vitest"
import { parseMarkdownTags } from "@vessel/obsidian"
import { decorateMarkdownTags } from "@/components/core/canvas/variants/markdown/decorate-tags"
afterEach(() => { document.body.innerHTML = "" })
it("parses Unicode and nested tags with exact source offsets", () => {
  const source = "# 标题\n#动画/视差滚动 #react #前端/React_19 #123 https://example.com/#anchor \\#escaped"
  expect(parseMarkdownTags(source).map((tag) => tag.raw)).toEqual(["#动画/视差滚动", "#react", "#前端/React_19"])
  for (const tag of parseMarkdownTags(source)) expect(source.slice(tag.start, tag.end)).toBe(tag.raw)
})
it("skips fenced code, inline code, indented code and unclosed fences", () => {
  const source = '#outside\n```md\n#hidden\n```\n`#inline` ``#other`` #visible\n    #indented\n~~~js\n#unclosed'
  expect(parseMarkdownTags(source).map((tag) => tag.raw)).toEqual(["#outside", "#visible"])
})
it("renders Badge markup only in prose and remains idempotent", () => {
  const root = document.createElement("div")
  root.innerHTML = '<p data-block="0">#动画/视差滚动</p><pre><code>#code</code></pre><p><code>#inline</code></p>'
  document.body.append(root)
  decorateMarkdownTags(root)
  decorateMarkdownTags(root)
  expect(root.querySelectorAll("[data-markdown-tag]")).toHaveLength(1)
  expect(root.querySelector("[data-markdown-tag]")?.className).toContain("rounded-full")
  expect(root.textContent).toBe("#动画/视差滚动#code#inline")
})
