import { afterEach, expect, it, vi } from "vitest"
import type Vditor from "vditor"
import { changeCodeLanguage } from "@/components/core/canvas/variants/markdown/change-code-language"

afterEach(() => { document.body.replaceChildren(); window.getSelection()?.removeAllRanges() })

it("uses local completion without replacing surrounding document, losing selection or scrolling", () => {
  document.body.innerHTML = '<main><p>keep this paragraph</p><div data-type="code-block"><span data-type="code-block-info">text</span><pre class="vditor-ir__marker"><code>print(1)</code></pre><pre class="vditor-ir__preview"><code><span>old rendered content</span></code></pre></div><p>keep this too</p></main>'
  const main = document.querySelector("main")!
  const paragraph = main.firstElementChild!
  const block = main.querySelector<HTMLElement>('[data-type="code-block"]')!
  const source = block.querySelector(".vditor-ir__marker code")!
  const range = document.createRange()
  range.setStart(paragraph.firstChild!, 2)
  range.collapse(true)
  window.getSelection()!.addRange(range)
  main.scrollTop = 250
  const setValue = vi.fn()
  const undo = vi.fn()
  const complete = vi.fn((option: HTMLElement) => {
    expect(option.dataset.value).toBe("python")
    expect(window.getSelection()!.anchorNode).toBe(block.querySelector('[data-type="code-block-info"]'))
    expect(block.querySelector(".vditor-ir__preview code")!.textContent).toBe("print(1)")
    main.scrollTop = 0
  })
  const editor = { setValue, vditor: { undo: { addToUndoStack: undo }, hint: { fillEmoji: complete } } } as unknown as Vditor
  expect(changeCodeLanguage(editor, block, "python")).toBe(true)
  expect(complete).toHaveBeenCalledOnce()
  expect(undo).toHaveBeenCalledOnce()
  expect(setValue).not.toHaveBeenCalled()
  expect(main.firstElementChild).toBe(paragraph)
  expect(block.querySelector(".vditor-ir__marker code")).toBe(source)
  expect(window.getSelection()!.anchorNode).toBe(paragraph.firstChild)
  expect(window.getSelection()!.anchorOffset).toBe(2)
  expect(main.scrollTop).toBe(250)
})

it("does nothing when language is unchanged or block is detached", () => {
  const block = document.createElement("div")
  block.innerHTML = '<span data-type="code-block-info">text</span><pre class="vditor-ir__marker"><code>content</code></pre>'
  const editor = {} as Vditor
  expect(changeCodeLanguage(editor, block, "python")).toBe(false)
  document.body.append(block)
  expect(changeCodeLanguage(editor, block, "text")).toBe(false)
})
