import { afterEach, expect, it, vi } from "vitest"
import { bindHeadingHandles, headingBlockRange, selectHeadingBlock, canCopyHeadingBlock } from "@/components/core/canvas/variants/markdown/heading-handles"

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

it("enables copy only for the block selected by a handle double-click", () => {
  document.body.innerHTML = '<div contenteditable="true"><h2>标题</h2><p>内容</p><h3>子标题</h3><p>子内容</p><h2>另一个标题</h2></div>'
  const [heading, other] = Array.from(document.querySelectorAll<HTMLElement>("h2"))
  expect(canCopyHeadingBlock(heading)).toBe(false)
  const selection = window.getSelection()!
  selection.removeAllRanges()
  selection.addRange(headingBlockRange(heading)!)
  expect(canCopyHeadingBlock(heading)).toBe(false)
  selectHeadingBlock(heading)
  expect(canCopyHeadingBlock(heading)).toBe(true)
  expect(canCopyHeadingBlock(other)).toBe(false)
  selection.collapse(heading, 0)
  expect(canCopyHeadingBlock(heading)).toBe(false)
})

it("notifies the outline after entering and leaving heading focus", async () => {
  vi.useFakeTimers()
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
  document.body.innerHTML = '<div id="root"><div class="vditor-toolbar"></div><div class="vditor-ir"><div class="vditor-reset" contenteditable="true"><h2>前面</h2><p>前文</p><h2 id="focus">当前</h2><p>正文</p><h3>子标题</h3><h2 id="next">后面</h2></div></div></div>'
  const root = document.getElementById("root")!
  const notify = vi.fn()
  root.addEventListener("vessel:heading-visibility", notify)
  const stop = bindHeadingHandles(root, () => {})
  try {
    await vi.advanceTimersByTimeAsync(40)
    const heading = document.getElementById("focus")!
    heading.dispatchEvent(new CustomEvent("vessel:heading-focus", { bubbles: true, detail: heading }))
    await vi.advanceTimersByTimeAsync(40)
    expect(document.getElementById("next")!.classList.contains("vessel-heading-focus-hidden")).toBe(true)
    expect(heading.classList.contains("vessel-heading-focus-hidden")).toBe(false)
    expect(notify).toHaveBeenCalledTimes(1)
    document.querySelector<HTMLButtonElement>(".vessel-heading-exit-focus")!.click()
    await vi.advanceTimersByTimeAsync(40)
    expect(root.querySelector(".vessel-heading-focus-hidden")).toBeNull()
    expect(notify).toHaveBeenCalledTimes(2)
  } finally { stop(); vi.useRealTimers(); vi.unstubAllGlobals() }
})
