import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
afterEach(cleanup)
it("keeps activity navigation available without executing the confirmation", () => {
  const navigate = vi.fn(), confirm = vi.fn(), close = vi.fn()
  render(<><button onClick={navigate}>活动栏</button><ConfirmDialog activityBarAccessible statusBarAccessible open onOpenChange={close} title="在默认浏览器中打开" description="测试链接" confirmText="打开" tone="primary" onConfirm={confirm} /></>)
  const activity = screen.getByRole("button", { name: "活动栏" })
  expect(activity.closest('[aria-hidden="true"]')).toBeNull()
  expect(document.body.style.pointerEvents).not.toBe("none")
  expect((document.querySelector("[data-confirm-overlay]") as HTMLElement).style.bottom).toBe("32px")
  fireEvent.click(activity)
  expect(navigate).toHaveBeenCalledOnce()
  expect(confirm).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "取消" }))
  expect(close).toHaveBeenCalledWith(false)
})
