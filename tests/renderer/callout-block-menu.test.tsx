import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CalloutBlockMenu } from "@/components/core/canvas/variants/markdown/callout-block-menu"
afterEach(cleanup)
it("offers focus above/below, copy and delete as context-menu actions", async () => {
  const focus = vi.fn(), copy = vi.fn(), remove = vi.fn()
  const view = render(<CalloutBlockMenu x={50} y={60} onClose={() => {}} onFocus={focus} onCopy={copy} onDelete={remove} />)
  expect(screen.getByRole("menuitem", { name: "复制" })).toBeTruthy()
  expect(screen.getByRole("menuitem", { name: "删除" })).toBeTruthy()
  const item = screen.getByRole("menuitem", { name: "聚焦" })
  item.focus()
  fireEvent.keyDown(item, { key: "ArrowRight" })
  expect(await screen.findByRole("menuitem", { name: "在上方聚焦" })).toBeTruthy()
  fireEvent.click(screen.getByRole("menuitem", { name: "在下方聚焦" }))
  await waitFor(() => expect(focus).toHaveBeenCalledWith(true))
  view.unmount()
  render(<CalloutBlockMenu x={50} y={60} onClose={() => {}} onFocus={focus} onCopy={copy} onDelete={remove} />)
  fireEvent.click(screen.getByRole("menuitem", { name: "复制" }))
  expect(copy).toHaveBeenCalledOnce()
})
