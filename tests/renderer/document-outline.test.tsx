import React from "react"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { DocumentOutline } from "../../src/renderer/src/components/core/canvas/variants/markdown/document-outline"
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
