import React from "react"
import { afterEach, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MarkdownDocument } from "../../src/renderer/src/components/core/canvas/variants/markdown/markdown-document"
import { parseMarkdownDocument } from "../../src/renderer/src/components/core/canvas/variants/markdown/parse-markdown"
afterEach(cleanup)
it("renders headings, shadcn tables and inline badges without tagging code", () => {
  const document = parseMarkdownDocument("# 标题\n\n#项目 `#代码`\n\n| 名称 | 数量 |\n| --- | --- |\n| A | 2 |\n\n# 标题")
  const { container } = render(<MarkdownDocument document={document} />)
  expect(document.headings.map((heading) => heading.id)).toEqual(["markdown-heading-0", "markdown-heading-1"])
  expect(screen.getByRole("table")).toBeTruthy()
  expect(screen.getByText("#项目").tagName).toBe("SPAN")
  expect(screen.getByText("#代码").tagName).toBe("CODE")
  expect(container.querySelector("p div")).toBeNull()
})
it("does not inject raw HTML or active script links", () => {
  const { container } = render(<MarkdownDocument document={parseMarkdownDocument("<script>alert(1)</script>\n\n[bad](javascript:alert)")} />)
  expect(container.querySelector("script")).toBeNull()
  expect(container.querySelector('a[href^="javascript:"]')).toBeNull()
})
