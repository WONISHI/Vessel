import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import LayoutAside from "@/components/workspace/components/layout-aside"
import LayoutActivityBar from "@/components/layout/activity-bar"
import { WorkspaceRouteCache } from "@/components/workspace-route-cache"

vi.mock("@vessel/react-router", async () => {
  const { useNavigate } = await import("react-router-dom")
  return { useRouter: () => ({ push: useNavigate() }) }
})
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ open: true, setOpen: vi.fn(), setOpenMobile: vi.fn(), isMobile: false, width: 280, setWidth: vi.fn() }),
  SidebarTrigger: () => <button>侧栏</button>,
  Sidebar: ({ children }: any) => children
}))
vi.mock("@/components/ui/resizable-split", () => ({
  ResizableSplit: ({ pane, children }: any) => (
    <>
      {pane}
      {children}
    </>
  )
}))
vi.mock("@/components/workspace/components/layout-aside/layout-workspace-sidebar", () => ({ default: ({ activity }: any) => <span data-testid="cached-sidebar">{activity}</span> }))
vi.mock("@/components/workspace/components/layout-aside/project-library", () => ({ ProjectLibrary: () => null }))
vi.mock("@/components/transit/button", () => ({ TransitButton: () => null }))
vi.mock("@/pages/resources/library-state", () => ({ selectLastPinned: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("restores the cached workspace rail and sidebar after Git renders a different rail", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { getSettings: vi.fn(async () => ({ backup: {} })), getBackupStatus: vi.fn(async () => ({})) } })
  render(
    <MemoryRouter initialEntries={["/editor/file"]}>
      <Routes>
        <Route element={<WorkspaceRouteCache />}>
          <Route
            path="/editor/*"
            element={
              <LayoutAside>
                <span>工作区文档</span>
              </LayoutAside>
            }
          />
          <Route
            path="/git"
            element={
              <>
                <LayoutActivityBar
                  activity="git"
                  onActivityChange={() => {}}
                />
                <span>Git 页面</span>
              </>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole("button", { name: "更多开发工具" }))
  fireEvent.click(await screen.findByRole("button", { name: /Git 代码版本管理/ }))
  expect(await screen.findByText("Git 页面")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "工作区" }))
  await waitFor(() => expect(screen.queryByText("Git 页面")).toBeNull())
  expect(screen.getByRole("button", { name: "工作区" }).getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "更多开发工具" }).getAttribute("aria-pressed")).toBe("false")
  expect(screen.getByTestId("cached-sidebar").textContent).toBe("files")
})
