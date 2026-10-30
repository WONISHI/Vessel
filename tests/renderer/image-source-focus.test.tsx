import { createRequire } from "node:module"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ObsidianImageLine } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image-line"
import { focusImageSourceBoundary, focusImageParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
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
it.each([false, true])("inserts a line next to the middle image in a shared source block, below=%s", (below) => {
  const source = "![[a.png]]![[b.png]]![[c.png]]"
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM(prepareObsidianImages(source))
  document.body.append(root)
  const offset = source.indexOf("![[b.png]]") + (below ? "![[b.png]]".length : 0)
  const paragraph = focusImageSourceBoundary(root.firstElementChild as HTMLElement, source, offset, (text) => lute.Md2VditorIRDOM(prepareObsidianImages(text)))!
  expect(root.children[1]).toBe(paragraph)
  expect(paragraph.tagName).toBe("P")
  expect(window.getSelection()?.anchorNode).toBe(paragraph)
  const left = decodeURIComponent(paragraph.previousElementSibling!.querySelector("pre.vditor-ir__marker code")!.textContent!.trim())
  const right = decodeURIComponent(paragraph.nextElementSibling!.querySelector("pre.vditor-ir__marker code")!.textContent!.trim())
  expect(left).toBe(source.slice(0, offset))
  expect(right).toBe(source.slice(offset))
  const saved = restoreObsidianImages(lute.VditorIRDOM2Md(root.innerHTML))
  for (const name of ["a", "b", "c"]) expect(saved.match(new RegExp(`!\\[\\[${name}\\.png\\]\\]`, "g"))).toHaveLength(1)
})
it("keeps a separate middle image's focus between its immediate neighbors", () => {
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
