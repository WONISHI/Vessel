import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CreateBranchDialog } from "@/pages/git/components/branch-dialog/components/create-branch-dialog"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("allows activity navigation while the branch dialog is open", async () => {
  vi.stubGlobal("ResizeObserver", class {
    observe() { /* Test stub. */ }
    unobserve() { /* Test stub. */ }
    disconnect() { /* Test stub. */ }
  })
  const navigate = vi.fn(), close = vi.fn()
  render(<>
    <button onClick={navigate}>活动栏浏览器</button>
    <CreateBranchDialog open onOpenChange={close} currentBranch="main" branches={["main"]} onCreate={vi.fn()} />
  </>)
  expect(screen.getByRole("dialog")).toBeTruthy()
  const activity = screen.getByRole("button", { name: "活动栏浏览器" })
  expect(activity.closest('[aria-hidden="true"]')).toBeNull()
  expect(document.body.style.pointerEvents).not.toBe("none")
  activity.focus()
  fireEvent.click(activity)
  expect(navigate).toHaveBeenCalledOnce()
  await waitFor(() => expect(close).toHaveBeenCalledWith(false))
})
