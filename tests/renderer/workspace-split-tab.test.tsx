import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { useState, type ReactNode } from "react"
import LayoutMain from "@/components/workspace/components/layout-main"
import { WorkspaceContext, type WorkspaceContextType } from "@/components/workspace/types/workspace"

vi.mock("@/components/core/canvas/index", () => ({ default: ({ activeFilePath }: { activeFilePath: string }) => <div data-testid="split-content">{activeFilePath}</div> }))
vi.mock("@/components/workspace/components/layout-main/document-tabs", () => ({ DocumentTabs: () => <div>主编辑区</div> }))
vi.mock("@/components/workspace/components/layout-main/file-search", () => ({ FileSearch: () => null }))
vi.mock("@/components/workspace/components/layout-main/terminal-panel", () => ({ TerminalPanel: () => null }))
vi.mock("@/components/backup-status", () => ({ BackupStatus: () => null }))
vi.mock("@/components/ui/status-bar", () => ({ StatusBar: () => null }))
vi.mock("@/components/ui/tooltip", () => ({ Tooltip: ({ children }: { children: ReactNode }) => children, TooltipTrigger: ({ children }: { children: ReactNode }) => children, TooltipContent: () => null }))
vi.mock("@/components/ui/resizable-panels", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children, id }: { children: ReactNode; id: string }) => <div data-pane={id}>{children}</div>,
  ResizableHandle: () => <div />
}))

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers() })

it("creates a separate split tab, retains original tabs and restores the split after switching back", () => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
  const files = [{ path: "/project/left.md", name: "left.md" }, { path: "/project/right.md", name: "right.md" }]
  const context = { workspace: { path: "/project", name: "project", files: [] }, openFiles: files, activeFilePath: files[0].path, openWorkspaceFile: vi.fn(), closeWorkspaceFile: vi.fn(), closeWorkspaceFiles: vi.fn(), navigateToWorkspaceHome: vi.fn() } as unknown as WorkspaceContextType
  const view = render(<MemoryRouter initialEntries={["/editor/file"]}><WorkspaceContext.Provider value={context}><LayoutMain /></WorkspaceContext.Provider></MemoryRouter>)
  const rightTab = screen.getByRole("button", { name: "right.md" }).closest('[data-workspace-tab]')!
  fireEvent.contextMenu(rightTab)
  fireEvent.click(screen.getByRole("menuitem", { name: "向右拆分" }))
  const activeTab = view.container.querySelector('[data-workspace-tab][data-active="true"]')!
  expect(within(activeTab as HTMLElement).getByText("left.md")).toBeTruthy()
  expect(within(activeTab as HTMLElement).getByText("right.md")).toBeTruthy()
  expect(within(activeTab as HTMLElement).getByLabelText("左右拆分")).toBeTruthy()
  expect(screen.getByTestId("split-content").textContent).toBe("/project/right.md")
  const pane = view.container.querySelector('[data-pane="split-document"]')!
  expect(pane.firstElementChild?.getAttribute("data-testid")).toBe("split-content")
  expect(view.container.querySelectorAll('[data-workspace-tab]')).toHaveLength(3)
  expect(context.openWorkspaceFile).toHaveBeenCalledWith(files[0])
  const combined = within(activeTab as HTMLElement).getByRole("button", { name: /left.md.*左右拆分.*right.md/ })
  fireEvent.click(screen.getByRole("button", { name: "left.md" }))
  expect(screen.queryByTestId("split-content")).toBeNull()
  expect(view.container.querySelectorAll('[data-workspace-tab]')).toHaveLength(3)
  fireEvent.click(combined)
  expect(screen.getByTestId("split-content")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "关闭拆分 left.md ↔ right.md" }))
  expect(screen.queryByTestId("split-content")).toBeNull()
  expect(view.container.querySelectorAll('[data-workspace-tab]')).toHaveLength(2)
  expect(context.closeWorkspaceFile).not.toHaveBeenCalled()
})

it("reveals a newly created split tab immediately and returns to its original primary file", () => {
  vi.useFakeTimers()
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
  const files = [{ path: "/project/left.md", name: "left.md" }, { path: "/project/right.md", name: "right.md" }]
  function Workspace() {
    const [activeFilePath, setActiveFilePath] = useState(files[0].path)
    const context = { workspace: { path: "/project", name: "project", files: [] }, openFiles: files, activeFilePath, openWorkspaceFile: (file: typeof files[number]) => setActiveFilePath(file.path), closeWorkspaceFile: vi.fn(), closeWorkspaceFiles: vi.fn(), navigateToWorkspaceHome: vi.fn() } as unknown as WorkspaceContextType
    return <WorkspaceContext.Provider value={context}><LayoutMain /></WorkspaceContext.Provider>
  }
  const view = render(<MemoryRouter initialEntries={["/editor/file"]}><Workspace /></MemoryRouter>)
  const strip = view.container.querySelector<HTMLElement>('[data-workspace-tab]')!.parentElement!
  strip.getBoundingClientRect = () => ({ left: 0, right: 300 }) as DOMRect
  const scrollBy = vi.fn()
  strip.scrollBy = scrollBy
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    return (this.hasAttribute("data-split-tab") ? { left: 310, right: 610 } : { left: 0, right: 300 }) as DOMRect
  })
  fireEvent.contextMenu(screen.getByRole("button", { name: "right.md" }).closest('[data-workspace-tab]')!)
  fireEvent.click(screen.getByRole("menuitem", { name: "向右拆分" }))
  vi.advanceTimersByTime(32)
  expect(scrollBy).toHaveBeenCalledWith({ left: 314, behavior: "instant" })
  const combined = screen.getByRole("button", { name: /left.md.*左右拆分.*right.md/ })
  fireEvent.click(screen.getByRole("button", { name: "right.md" }))
  expect(screen.queryByTestId("split-content")).toBeNull()
  fireEvent.click(combined)
  expect(view.container.querySelector('[data-workspace-tab][data-active="true"]')).toBe(combined.parentElement)
  expect(screen.getByTestId("split-content").textContent).toBe(files[1].path)
})
