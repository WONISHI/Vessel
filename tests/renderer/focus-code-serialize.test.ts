import { createRequire } from "node:module"
import { afterEach, expect, it } from "vitest"
import { focusInsideCodeBlock } from "@/components/core/canvas/variants/markdown/image-paragraph"
createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()
afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })
it("serializing after inside focus does not create an empty outer paragraph", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("前文\n\n```python\nprint(1)\n```\n\n后文\n")
  document.body.append(root)
  const block = root.querySelector<HTMLElement>('[data-type="code-block"]')!
  focusInsideCodeBlock(block, false)
  focusInsideCodeBlock(block, true)
  const md = lute.VditorIRDOM2Md(root.innerHTML)
  const round = lute.Md2VditorIRDOM(md)
  const wrap = document.createElement("div")
  wrap.innerHTML = round
  const code = wrap.querySelector('[data-type="code-block"]')!
  const prev = code.previousElementSibling as HTMLElement
  const next = code.nextElementSibling as HTMLElement
  expect(prev.textContent?.replace(/\u200b/g, "").trim()).toBe("前文")
  expect(next.textContent?.replace(/\u200b/g, "").trim()).toBe("后文")
  // no empty paragraph neighbors
  expect(!(prev.textContent || "").replace(/[\u200b\s]/g, "")).toBe(false)
  expect(!(next.textContent || "").replace(/[\u200b\s]/g, "")).toBe(false)
  expect(code.querySelector("pre.vditor-ir__marker code")?.textContent?.startsWith("\n")).toBe(true)
})
