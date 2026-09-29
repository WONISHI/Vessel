import { expect, it } from "vitest"
import { decorateInlineHTML } from "../../src/renderer/src/components/core/canvas/variants/markdown/inline-html"
it("previews font colors while retaining markers and rejecting executable attributes", () => {
  const root = document.createElement("div")
  root.innerHTML = '<strong><span data-type="html-inline"><code>&lt;font color="red" onclick="bad()"&gt;</code></span>信息的质量属性<span data-type="html-inline"><code>&lt;/font&gt;</code></span></strong>'
  const source = root.textContent
  decorateInlineHTML(root)
  decorateInlineHTML(root)
  const preview = root.querySelector<HTMLElement>("[data-vessel-inline-html]")!
  expect(preview.style.color).toBe("red")
  expect(preview.textContent).toBe("信息的质量属性")
  expect(preview.hasAttribute("onclick")).toBe(false)
  expect(root.textContent).toBe(source)
  expect(root.querySelectorAll("[data-vessel-inline-html]")).toHaveLength(1)
})
