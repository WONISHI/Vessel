import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ObsidianImageLine } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image-line"
import { focusImageParagraph, focusInsideCodeBlock, insertEmptyLineInSource, VESSEL_BLANK_LINE } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { createRequire } from "node:module"
vi.mock("@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image", () => ({
  ObsidianImage: ({ onFocusAbove, onFocusBelow }: { onFocusAbove: () => void; onFocusBelow: () => void }) => <div><button onClick={onFocusAbove}>上方</button><button onClick={onFocusBelow}>下方</button></div>
}))
createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()
afterEach(() => { cleanup(); document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })
it("passes the clicked image offsets, including repeated references", () => {
  const source = "![[a.png]] ![[b.png]] ![[a.png]]"
  const above = vi.fn(), below = vi.fn()
  render(<ObsidianImageLine source={source} root="/w" documentPath="/w/n.md" onChange={() => {}} onFocusAbove={above} onFocusBelow={below} />)
  fireEvent.click(screen.getAllByText("上方")[1])
  fireEvent.click(screen.getAllByText("下方")[1])
  expect(above).toHaveBeenCalledWith(source.indexOf("![[b.png]]"))
  expect(below).toHaveBeenCalledWith(source.indexOf("![[b.png]]") + "![[b.png]]".length)
  fireEvent.click(screen.getAllByText("上方")[2])
  expect(above).toHaveBeenLastCalledWith(source.lastIndexOf("![[a.png]]"))
})
it("insertEmptyLineInSource adds an inside blank marker without raw newlines", () => {
  expect(insertEmptyLineInSource("![[a.png]]", 0)).toBe(`${VESSEL_BLANK_LINE}![[a.png]]`)
  expect(insertEmptyLineInSource("![[a.png]]", "![[a.png]]".length)).toBe(`![[a.png]]${VESSEL_BLANK_LINE}`)
  expect(insertEmptyLineInSource("![[a.png]]![[b.png]]", "![[a.png]]".length)).toBe(`![[a.png]]${VESSEL_BLANK_LINE}![[b.png]]`)
  expect(insertEmptyLineInSource("![[a.png]]", 0).includes("\n")).toBe(false)
})
it("blank markers survive prepare/restore on one image line (not an outer empty paragraph)", () => {
  const source = insertEmptyLineInSource("![[a.png]]", 0)
  const doc = `前文\n\`\`\`vessel-obsidian-image\n${encodeURIComponent(source)}\n\`\`\`\n后文\n`
  const restored = restoreObsidianImages(doc)
  expect(restored).toContain(`${VESSEL_BLANK_LINE}![[a.png]]`)
  const prepared = prepareObsidianImages(restored)
  expect(prepared).toContain("vessel-obsidian-image")
  expect(prepared).not.toMatch(/vessel-obsidian-image\n%0A/)
  // Blank marker stays on the same restored line as the image reference (not its own markdown line)
  expect(restored.split("\n").some((line) => line.includes("![[a.png]]") && line.includes(VESSEL_BLANK_LINE))).toBe(true)
})
it("renders blank markers from the image source inside the component", () => {
  const { container } = render(<ObsidianImageLine source={`${VESSEL_BLANK_LINE}![[a.png]]${VESSEL_BLANK_LINE}`} root="/w" documentPath="/w/n.md" onChange={() => {}} />)
  expect(container.querySelectorAll('[aria-hidden]')).toHaveLength(2)
})
it("focusInsideCodeBlock inserts an empty line inside the code block without outer empty siblings", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM("前文\n\n```python\nprint(1)\n```\n\n后文\n")
  document.body.append(root)
  const block = root.querySelector<HTMLElement>('[data-type="code-block"]')!
  const prev = block.previousElementSibling
  const next = block.nextElementSibling
  const paragraphs = root.querySelectorAll("p").length
  const code = focusInsideCodeBlock(block, false)!
  expect(code.textContent?.startsWith("\n")).toBe(true)
  expect(block.previousElementSibling).toBe(prev)
  expect(block.nextElementSibling).toBe(next)
  expect(root.querySelectorAll("p").length).toBe(paragraphs)
  focusInsideCodeBlock(block, true)
  expect(block.previousElementSibling).toBe(prev)
  expect(block.nextElementSibling).toBe(next)
  expect(root.querySelectorAll("p").length).toBe(paragraphs)
  // Fail if an empty outer paragraph was inserted beside the component
  expect([prev, next].some((node) => node instanceof HTMLElement && !(node.textContent || "").replace(/[\u200b\s]/g, ""))).toBe(false)
})
it("keeps a separate middle image's outside focus between its immediate neighbors", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<div id="a"></div><div id="b"></div><div id="c"></div>'
  document.body.append(root)
  const b = root.children[1] as HTMLElement
  const above = focusImageParagraph(b, false)!
  const below = focusImageParagraph(b, true)!
  expect(b.previousElementSibling).toBe(above)
  expect(b.nextElementSibling).toBe(below)
  expect(above.previousElementSibling?.id).toBe("a")
  expect(below.nextElementSibling?.id).toBe("c")
})
