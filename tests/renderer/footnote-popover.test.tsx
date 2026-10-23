import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { FootnotePopover } from "@/components/core/canvas/variants/markdown/footnote-popover"

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})
function setup() {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const text = document.createElement("p")
  text.textContent = "选中文字"
  document.body.append(text)
  const range = document.createRange()
  range.selectNodeContents(text)
  Object.defineProperty(range, "getBoundingClientRect", { value: () => ({ x: 100, y: 100, left: 100, top: 100, bottom: 120, right: 200, width: 100, height: 20 }) })
  const insert = vi.fn(),
    cancel = vi.fn()
  render(
    <FootnotePopover
      text="选中文字"
      range={range}
      onInsert={insert}
      onCancel={cancel}
    />
  )
  return { insert, cancel }
}
it("uses a compact non-modal input popover and submits with Ctrl+Enter", async () => {
  const { insert } = setup()
  const input = screen.getByRole("textbox", { name: "脚注内容" })
  await waitFor(() => expect(document.activeElement).toBe(input))
  expect(screen.getByRole("dialog", { name: "添加脚注" }).getAttribute("aria-modal")).not.toBe("true")
  expect(document.body.style.pointerEvents).not.toBe("none")
  expect((screen.getByRole("button", { name: "添加脚注" }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(input, { target: { value: "补充说明" } })
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true })
  expect(insert).toHaveBeenCalledWith("补充说明")
})
it("closes on Escape and requests restoring the original text selection", async () => {
  const { cancel } = setup()
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "脚注内容" })))
  fireEvent.keyDown(document.activeElement!, { key: "Escape" })
  expect(cancel).toHaveBeenCalledWith(true)
})
