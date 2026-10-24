import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CodeLanguageDialog } from "@/components/core/canvas/variants/markdown/code-language-dialog"
import { decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"
import { useEffect, useRef, useState } from "react"
import userEvent from "@testing-library/user-event"

afterEach(cleanup)
it("keeps the language picker open after a complete code header click", async () => {
  function Editor() {
    const root = useRef<HTMLDivElement>(null)
    const [block, setBlock] = useState<HTMLElement | null>(null)
    useEffect(() => {
      const element = root.current!
      element.innerHTML = '<div data-type="code-block"><pre class="vditor-ir__marker"><code>plain text</code></pre></div>'
      decorateCodeBlocks(element)
      const open = (event: Event) => setBlock((event as CustomEvent<HTMLElement>).detail)
      element.addEventListener("vessel-code-language", open)
      return () => element.removeEventListener("vessel-code-language", open)
    }, [])
    return <><div ref={root} data-testid="editor" />{block && <CodeLanguageDialog anchor={block} value="text" onClose={() => setBlock(null)} onConfirm={() => setBlock(null)} />}</>
  }
  render(<Editor />)
  await userEvent.click(screen.getByTestId("editor").querySelector("pre")!)
  expect(screen.getByRole("dialog", { name: "代码语言" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "搜索语言" })).toBe(document.activeElement)
})
it("filters languages and applies the draft only on confirmation", () => {
  const confirm = vi.fn()
  render(<CodeLanguageDialog value="text" onClose={vi.fn()} onConfirm={confirm} />)
  fireEvent.change(screen.getByRole("combobox", { name: "搜索语言" }), { target: { value: "typescript" } })
  expect(screen.queryByRole("option", { name: /javascript/ })).toBeNull()
  fireEvent.click(screen.getByRole("option", { name: /typescript/ }))
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(confirm).toHaveBeenCalledWith("ts")
})
it("cancels a changed selection without applying it", () => {
  const close = vi.fn(), confirm = vi.fn()
  render(<CodeLanguageDialog value="text" onClose={close} onConfirm={confirm} />)
  fireEvent.click(screen.getByRole("option", { name: /javascript/ }))
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(close).toHaveBeenCalledOnce()
  expect(confirm).not.toHaveBeenCalled()
})
it("normalizes the old step value to a single steps option", () => {
  const confirm = vi.fn()
  render(<CodeLanguageDialog value="step" onClose={vi.fn()} onConfirm={confirm} />)
  expect(screen.getByRole("option", { name: /steps/ }).getAttribute("aria-selected")).toBe("true")
  expect(screen.queryByRole("option", { name: "step" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "确定" }))
  expect(confirm).toHaveBeenCalledWith("steps")
})

it("selects a filtered Python result with ArrowDown and confirms it with Enter", () => {
  const confirm = vi.fn()
  render(<CodeLanguageDialog value="text" onClose={vi.fn()} onConfirm={confirm} />)
  const input = screen.getByRole("combobox", { name: "搜索语言" })
  fireEvent.change(input, { target: { value: "python" } })
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(screen.getByRole("option", { name: /python/ }).getAttribute("aria-selected")).toBe("true")
  expect(document.activeElement).toBe(input)
  fireEvent.keyDown(input, { key: "Enter" })
  expect(confirm).toHaveBeenCalledWith("python")
})
