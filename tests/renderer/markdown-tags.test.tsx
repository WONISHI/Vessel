import { expect, it } from "vitest"
import { decorateMarkdownTags } from "../../src/renderer/src/components/core/canvas/variants/markdown/decorate-tags"
it("decorates nested tags without changing source text or touching code", () => {
  const root = document.createElement("div")
  root.innerHTML = "<p>#动画/视差滚动 普通文字 #标签</p><pre><code>#代码</code></pre><h1>#标题</h1>"
  const before = root.textContent
  decorateMarkdownTags(root)
  decorateMarkdownTags(root)
  expect(root.querySelectorAll("[data-markdown-tag]")).toHaveLength(2)
  expect(root.textContent).toBe(before)
  expect(root.querySelector("code [data-markdown-tag]")).toBeNull()
})
