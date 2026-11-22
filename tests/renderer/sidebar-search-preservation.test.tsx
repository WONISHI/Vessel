import { useEffect } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { TooltipProvider } from "@/components/ui/tooltip"
import LayoutWorkspaceSidebar from "@/components/workspace/components/layout-aside/layout-workspace-sidebar"

const lifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }))
vi.mock("@/components/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { name: "notes", path: "/notes", files: [] }, activeFilePath: "", expandDirectory: vi.fn(), openWorkspaceFile: vi.fn() }) }))
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ open: true, setOpen: vi.fn() }) }))
vi.mock("@/components/workspace/components/layout-aside/layout-workspace-sidebar/workspace-tree", () => ({ default: function MockTree() {
  useEffect(() => { lifecycle.mount(); return () => { lifecycle.unmount() } }, [])
  return <div data-testid="directory-content">已有目录内容</div>
} }))
vi.mock("@/pages/search/components/search-panel", () => ({ SearchPanel: ({ onClose }: { onClose: () => void }) => <button onClick={onClose}>关闭搜索</button> }))
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })

it("keeps the same directory and scroll viewport behind search throughout exit", () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  render(<MemoryRouter><TooltipProvider><LayoutWorkspaceSidebar activity="files" /></TooltipProvider></MemoryRouter>)
  const directory = screen.getByTestId("directory-content")
  const viewport = directory.closest('[data-radix-scroll-area-viewport]')!
  viewport.scrollTop = 480
  fireEvent.click(screen.getByRole("button", { name: "全文搜索" }))
  expect(screen.getByTestId("directory-content")).toBe(directory)
  expect(directory.closest('[aria-label="工作区侧边栏"]')?.hasAttribute("inert")).toBe(true)
  fireEvent.click(screen.getByText("关闭搜索"))
  const search = screen.getByRole("region", { name: "工作区全文搜索" })
  expect(search.dataset.state).toBe("closed")
  expect(viewport.scrollTop).toBe(480)
  expect(lifecycle.unmount).not.toHaveBeenCalled()
  for (const type of ["animationend", "webkitAnimationEnd"]) {
    const event = new Event(type, { bubbles: true })
    Object.defineProperty(event, "animationName", { value: "vessel-search-out" })
    fireEvent(search, event)
  }
  expect(screen.queryByRole("region", { name: "工作区全文搜索" })).toBeNull()
  expect(screen.getByTestId("directory-content")).toBe(directory)
  expect(viewport.scrollTop).toBe(480)
  expect(lifecycle.mount).toHaveBeenCalledOnce()
  expect(lifecycle.unmount).not.toHaveBeenCalled()
})
