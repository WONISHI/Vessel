import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { type ReactNode } from "react"
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
  ResizableHandle: () => <div data-divider="true" />
}))

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); vi.useRealTimers() })

function renderTabs() {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
  const files = [{ path: "/project/document.md", name: "document.md" }, { path: "/project/page.html", name: "page.html" }, { path: "/project/report.docx", name: "report.docx" }]
  const context = { workspace: { path: "/project", name: "project", files: [] }, openFiles: files, activeFilePath: files[0].path, openWorkspaceFile: vi.fn(), closeWorkspaceFile: vi.fn(), closeWorkspaceFiles: vi.fn(), navigateToWorkspaceHome: vi.fn() } as unknown as WorkspaceContextType
  return render(<MemoryRouter initialEntries={["/editor/file"]}><WorkspaceContext.Provider value={context}><LayoutMain /></WorkspaceContext.Provider></MemoryRouter>)
}

it("only offers split on ordinary tabs, while retaining other actions on the split tab", () => {
  const view = renderTabs()
  fireEvent.contextMenu(screen.getByRole("button", { name: "page.html" }).closest('[data-workspace-tab]')!)
  fireEvent.click(screen.getByRole("menuitem", { name: "向右拆分" }))
  const split = view.container.querySelector('[data-split-tab]')!
  fireEvent.contextMenu(split)
  expect(screen.queryByRole("menuitem", { name: "向右拆分" })).toBeNull()
  expect(screen.getByRole("menuitem", { name: "关闭", exact: true })).toBeTruthy()
  expect(screen.getByRole("menuitem", { name: "复制路径", exact: true })).toBeTruthy()
})

it.each([["document.md", false], ["report.docx", false], ["page.html", true]] as const)("gates the browser menu by the file type for %s", (name, allowed) => {
  renderTabs()
  fireEvent.contextMenu(screen.getByRole("button", { name }).closest('[data-workspace-tab]')!)
  expect(!!screen.queryByRole("menuitem", { name: "在默认浏览器中打开" })).toBe(allowed)
  expect(screen.getByRole("menuitem", { name: "向右拆分" })).toBeTruthy()
})

it.each(["left", "right"] as const)("places the divider between panels for a %s split", (side) => {
  const view = renderTabs()
  fireEvent(window, new CustomEvent("vessel:split-document", { detail: { root: "/project", path: "/project/page.html", side } }))
  const primary = view.container.querySelector('[data-pane="primary-document"]')!
  const order = [...primary.parentElement!.children].map((element) => element.getAttribute("data-pane") || "divider")
  expect(order).toEqual(side === "left" ? ["split-document", "divider", "primary-document"] : ["primary-document", "divider", "split-document"])
})
