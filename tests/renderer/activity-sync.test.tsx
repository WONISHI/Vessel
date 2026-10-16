// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/editor", search: "" }) }))
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ open: true }), SidebarTrigger: () => <button>侧栏</button> }))
vi.mock("@/components/transit/button", () => ({ TransitButton: () => null }))
vi.mock("@/pages/resources/library-state", () => ({ selectLastPinned: vi.fn() }))
afterEach(cleanup)
it("runs whole-workspace sync from the home context menu without navigating", async () => {
  const runBackup = vi.fn(async () => ({ running: false }))
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      getSettings: vi.fn(async () => ({ backup: { enabled: true, workspacePath: "/notes" } })),
      getBackupStatus: vi.fn(async () => ({ running: false })),
      runBackup
    }
  })
  const change = vi.fn()
  render(
    <LayoutActivityBar
      activity="files"
      onActivityChange={change}
    />
  )
  await waitFor(() => expect(window.electronAPI.getSettings).toHaveBeenCalled())
  fireEvent.contextMenu(screen.getByRole("button", { name: "工作区" }))
  const item = screen.getByRole("menuitem", { name: "同步" })
  await waitFor(() => expect(item.getAttribute("aria-disabled")).not.toBe("true"))
  fireEvent.click(item)
  await waitFor(() => expect(runBackup).toHaveBeenCalledWith())
  expect(change).not.toHaveBeenCalled()
})
