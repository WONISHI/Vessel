import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DocumentOutline } from "@/components/core/canvas/variants/markdown/document-outline"
afterEach(cleanup)

it("expands on hover, stays open only when pinned, and marks the active heading", async () => {
  const onSelect = vi.fn()
  const { container } = render(
    <DocumentOutline
      headings={[
        { text: "标题一", level: 1 },
        { text: "标题二", level: 3 }
      ]}
      activeIndex={1}
      onSelect={onSelect}
    />
  )
  const outline = screen.getByRole("complementary")
  const lines = container.querySelectorAll<HTMLElement>('[aria-hidden="true"].animate-none')
  expect(lines).toHaveLength(2)
  expect(parseInt(lines[0].style.width)).toBeGreaterThan(parseInt(lines[1].style.width))
  expect(screen.getByRole("button", { name: "标题二" }).getAttribute("aria-current")).toBe("location")
  fireEvent.mouseEnter(outline)
  expect(screen.getByText("标题一")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "固定大纲" }))
  fireEvent.mouseLeave(outline)
  expect(screen.getByText("标题一")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "标题二" }))
  expect(onSelect).toHaveBeenCalledWith(1)
  fireEvent.click(screen.getByRole("button", { name: "取消固定大纲" }))
  fireEvent.mouseLeave(outline)
  await waitFor(() => expect(screen.getByText("标题一").closest("[aria-hidden]")?.getAttribute("aria-hidden")).toBe("true"))
})

it("folds descendants by hierarchy without changing navigation indexes", () => {
  const onSelect = vi.fn()
  render(<DocumentOutline headings={[{ text: "文档", level: 1 }, { text: "项目", level: 2 }, { text: "反查端", level: 3 }, { text: "远程办公", level: 2 }, { text: "附录", level: 1 }]} activeIndex={2} onSelect={onSelect} workspacePath="/vault" documentPath="/vault/note.md" />)
  fireEvent.mouseEnter(screen.getByRole("complementary"))
  expect(screen.getAllByText("H1")).toHaveLength(2)
  fireEvent.click(screen.getByRole("button", { name: "折叠项目" }))
  expect(screen.queryByText("反查端")).toBeNull()
  expect(screen.getByLabelText("1 个子标题")).toBeTruthy()
  expect(onSelect).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "远程办公" }))
  expect(onSelect).toHaveBeenCalledWith(3)
  fireEvent.click(screen.getByRole("button", { name: "折叠全部标题" }))
  expect(screen.queryByText("项目")).toBeNull()
  expect(screen.getByText("附录")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "展开全部标题" }))
  expect(screen.getByText("反查端")).toBeTruthy()
  expect(screen.getByRole("button", { name: "反查端" }).getAttribute("aria-current")).toBe("location")
})
