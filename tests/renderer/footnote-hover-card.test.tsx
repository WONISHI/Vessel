import { fireEvent, render, screen, cleanup, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { createRef } from "react"
import { FootnoteHoverCard } from "@/components/core/canvas/variants/markdown/footnote-hover-card"
import { decorateInlineHTML } from "@/components/core/canvas/variants/markdown/inline-html"
import { createRequire } from "node:module"
createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("shows the parsed footnote in a shadcn Hover Card and closes after leaving", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const host = createRef<HTMLDivElement>()
  render(
    <>
      <div ref={host}>
        <span
          data-vessel-footnote-id="1"
          tabIndex={0}
        >
          选中文字
        </span>
      </div>
      <FootnoteHoverCard
        host={host}
        source={() => "选中文字[^1]\n\n[^1]: 补充说明"}
      />
    </>
  )
  fireEvent.pointerOver(screen.getByText("选中文字"), { pointerType: "mouse" })
  expect(await screen.findByText("补充说明")).toBeTruthy()
  fireEvent.pointerOut(screen.getByText("选中文字"), { pointerType: "mouse", relatedTarget: document.body })
  await waitFor(() => expect(screen.queryByText("补充说明")).toBeNull())
})
it("decorates persisted boundaries without losing their Markdown serialization", () => {
  const lute = (globalThis as any).Lute.New()
  const source = '前文<span data-vessel-footnote="1">选中文字</span>[^1]\n\n[^1]: 说明'
  const root = document.createElement("div")
  root.innerHTML = lute.Md2VditorIRDOM(source)
  decorateInlineHTML(root)
  expect(root.querySelector('[data-vessel-footnote-id="1"]')?.textContent).toBe("选中文字")
  expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain('data-vessel-footnote="1"')
  expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[^1]: 说明")
})

it("offers deletion from the footnote context menu", async () => {
  const host = createRef<HTMLDivElement>()
  const onDelete = vi.fn()
  render(
    <>
      <div ref={host}>
        <span data-vessel-footnote-id="4">带脚注文字</span>
      </div>
      <FootnoteHoverCard
        host={host}
        source={() => "文字[^4]\n\n[^4]: 说明"}
        onDelete={onDelete}
      />
    </>
  )
  fireEvent.contextMenu(screen.getByText("带脚注文字"), { clientX: 120, clientY: 80 })
  fireEvent.click(await screen.findByRole("menuitem", { name: "删除脚注" }))
  expect(onDelete).toHaveBeenCalledWith("4")
  expect(screen.queryByRole("menuitem")).toBeNull()
})
