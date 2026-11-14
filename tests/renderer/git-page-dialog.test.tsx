import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitPageDialog, GitPageDialogContent } from "@/pages/git/components/git-page-dialog"
import { DialogTitle, DialogDescription } from "@/components/ui/dialog"

afterEach(cleanup)
it("leaves activity navigation interactive and offsets the overlay", () => {
  const navigate = vi.fn()
  const { unmount } = render(<>
    <button onClick={navigate}>活动栏</button>
    <GitPageDialog open>
      <GitPageDialogContent><DialogTitle>测试弹窗</DialogTitle><DialogDescription>内容</DialogDescription></GitPageDialogContent>
    </GitPageDialog>
  </>)
  const button = screen.getByRole("button", { name: "活动栏" })
  expect(button.closest('[aria-hidden="true"]')).toBeNull()
  expect(document.body.style.pointerEvents).not.toBe("none")
  expect(document.querySelector('[data-git-dialog-overlay]')?.classList.contains('left-[52px]')).toBe(true)
  fireEvent.click(button)
  expect(navigate).toHaveBeenCalledOnce()
  unmount()
  expect(document.querySelector('[data-git-dialog-overlay]')).toBeNull()
})
