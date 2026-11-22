import { act, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { decorateCodeBlocks, clearCodeHighlights } from "@/components/core/canvas/variants/markdown/code-blocks"
import { toast } from "sonner"

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
let editor: HTMLDivElement
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  editor = document.createElement("div")
  editor.innerHTML = '<div data-type="code-block"><pre class="vditor-ir__marker"><code class="language-python">print(1)</code></pre></div>'
  document.body.append(editor)
  decorateCodeBlocks(editor)
})
afterEach(async () => {
  await act(async () => clearCodeHighlights(editor))
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it("flips to a check and shows a shadcn tooltip for one second, renewing on repeated copies", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => undefined) } })
  const button = editor.querySelector<HTMLButtonElement>(".vessel-code-copy")!
  await act(async () => { button.click() })
  expect(button.dataset.copied).toBe("true")
  expect(screen.getByRole("tooltip").textContent).toBe("已复制")
  expect(editor.textContent).toBe("print(1)")
  expect(toast.success).not.toHaveBeenCalled()
  await act(async () => { await vi.advanceTimersByTimeAsync(700); button.click() })
  await act(async () => { await vi.advanceTimersByTimeAsync(700) })
  expect(button.dataset.copied).toBe("true")
  expect(screen.getAllByRole("tooltip")).toHaveLength(1)
  await act(async () => { await vi.advanceTimersByTimeAsync(300) })
  expect(button.dataset.copied).toBeUndefined()
  expect(button.getAttribute("aria-label")).toBe("复制代码")
  expect(screen.queryByRole("tooltip")).toBeNull()
})

it("keeps the copy icon and reports failure when the clipboard rejects", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => { throw new Error("denied") }) } })
  const button = editor.querySelector<HTMLButtonElement>(".vessel-code-copy")!
  await act(async () => { button.click() })
  expect(button.dataset.copied).toBeUndefined()
  expect(screen.queryByRole("tooltip")).toBeNull()
  expect(toast.error).toHaveBeenCalledWith("复制代码失败")
})
