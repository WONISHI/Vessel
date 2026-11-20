import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { setActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { setStatusBarVisible } from "@/features/status-bar/visibility"
import { useDialogLayout } from "@/features/layout/use-dialog-layout"
import { GitPageDialog, GitPageDialogContent } from "@/pages/git/components/git-page-dialog"
import { DialogTitle } from "@/components/ui/dialog"

afterEach(() => { cleanup(); setActivityBarCollapsed(false); setStatusBarVisible(true) })

it("updates an open Git overlay and dialog when activity navigation is hidden", () => {
  render(<GitPageDialog open><GitPageDialogContent aria-describedby={undefined}><DialogTitle>布局测试</DialogTitle></GitPageDialogContent></GitPageDialog>)
  const overlay = document.querySelector<HTMLElement>("[data-git-dialog-overlay]")!
  const dialog = screen.getByRole("dialog")
  expect(overlay.style.left).toBe("52px")
  act(() => setActivityBarCollapsed(true))
  expect(overlay.style.left).toBe("0px")
  expect(dialog.style.left).toBe("calc(50% + 0px)")
  expect(dialog.style.width).toBe("calc(100vw - 32px)")
  act(() => setActivityBarCollapsed(false))
  expect(overlay.style.left).toBe("52px")
})

it("only reserves space for visible navigation and status bars", () => {
  function Layout() {
    const layout = useDialogLayout(true)
    return <div data-testid="overlay" style={layout.overlayStyle} />
  }
  render(<Layout />)
  const overlay = screen.getByTestId("overlay")
  expect(overlay.style.bottom).toBe("32px")
  act(() => { setStatusBarVisible(false); setActivityBarCollapsed(true) })
  expect(overlay.style.bottom).toBe("0px")
  expect(overlay.style.left).toBe("0px")
})
