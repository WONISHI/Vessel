import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ToastErrorDetails } from "@/components/ui/toast-error-details"

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

it("expands overflowing logs into ScrollArea and can collapse again", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(500)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(120)
  const changed = vi.fn()
  const { container } = render(<ToastErrorDetails text={"remote: error\n".repeat(50)} onExpandedChange={changed} />)
  fireEvent.click(screen.getByRole("button", { name: "展开完整错误信息" }))
  expect(container.querySelector('[data-vessel-scroll="area"]')).not.toBeNull()
  expect(screen.getByRole("button", { name: "收起" }).getAttribute("aria-expanded")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "收起" }))
  expect(container.querySelector('[data-vessel-scroll="area"]')).toBeNull()
  expect(changed).toHaveBeenCalledTimes(2)
})

it("does not show an expand button for short messages", () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(20)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20)
  render(<ToastErrorDetails text="连接失败" />)
  expect(screen.queryByRole("button")).toBeNull()
})
