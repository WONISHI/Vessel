import { afterEach, expect, it } from "vitest"
import { headingBlockRange } from "@/components/core/canvas/variants/markdown/heading-handles"

afterEach(() => document.body.replaceChildren())

it("selects subordinate headings and content but stops before the next peer", () => {
  document.body.innerHTML = "<h2>标题</h2><p>内容</p><h3>子标题</h3><p>子内容</p><h2>下一个标题</h2>"
  const range = headingBlockRange(document.querySelector("h2")!)!
  expect(range.toString()).toBe("标题内容子标题子内容")
})

it("keeps footnote definitions outside a final heading section", () => {
  document.body.innerHTML = '<h2>标题</h2><p>内容</p><div data-type="footnotes-block">脚注定义</div>'
  expect(headingBlockRange(document.querySelector("h2")!)!.toString()).toBe("标题内容")
})
