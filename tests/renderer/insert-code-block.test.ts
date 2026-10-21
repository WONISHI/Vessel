import { afterEach, expect, it, vi } from "vitest"
import type Vditor from "vditor"
import { insertEmptyCodeBlock } from "@/components/core/canvas/variants/markdown/insert-code-block"

afterEach(() => document.body.replaceChildren())

it("inserts an empty fence and focuses its code without selecting an existing block", () => {
  const editable = document.createElement("div")
  editable.contentEditable = "true"
  editable.tabIndex = 0
  editable.innerHTML = '<div data-type="code-block"><pre class="vditor-ir__marker"><code>existing code</code></pre></div>'
  document.body.append(editable)
  const insertMD = vi.fn(() => {
    editable.insertAdjacentHTML("beforeend", '<div data-type="code-block"><pre class="vditor-ir__marker"><code class="language-text">\n</code></pre></div>')
  })
  insertEmptyCodeBlock({ insertMD } as unknown as Vditor, editable)
  expect(insertMD).toHaveBeenCalledWith("```text\n\n```\n")
  const code = editable.querySelectorAll("code")[1]
  expect(code.textContent?.trim()).toBe("")
  expect(editable.querySelector("code")!.textContent).toBe("existing code")
  expect(document.activeElement).toBe(editable)
  const selection = window.getSelection()!
  expect(selection.anchorNode).toBe(code)
  expect(selection.anchorOffset).toBe(0)
  expect(selection.isCollapsed).toBe(true)
})
