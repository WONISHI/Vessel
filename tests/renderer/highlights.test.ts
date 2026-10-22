import { expect, it } from "vitest"
import { decorateHighlights } from "@/components/core/canvas/variants/markdown/decorate-highlights"

it("decorates prose and table cells without changing source text or code", () => {
  const root = document.createElement("pre")
  root.className = "vditor-reset"
  root.innerHTML = '<p>==ITIL（基础架构库）==、==ITSM==</p><table><tbody><tr><td>==ITSS==</td></tr></tbody></table><pre><code>==code==</code></pre>'
  const original = root.textContent
  decorateHighlights(root)
  decorateHighlights(root)
  expect(root.querySelectorAll("[data-vessel-highlight]")).toHaveLength(3)
  expect(root.querySelectorAll("[data-highlight-marker]")).toHaveLength(6)
  expect(root.textContent).toBe(original)
  expect(root.querySelector("code [data-vessel-highlight]")).toBeNull()
})
