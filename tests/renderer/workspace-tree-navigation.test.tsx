import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import WorkspaceTree from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/workspace-tree"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
vi.mock("@/components/workspace/hooks/file-changes", () => ({ useFileChanges: () => {} }))
vi.mock("@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-actions", () => ({ FileActions: ({ children }: any) => children }))
vi.mock("@/components/ui/tree", () => ({
  VirtualTree: ({ rows, renderRow }: any) => (
    <div>
      {rows.map((row: any, index: number) => (
        <div key={row.id}>{renderRow(row, index)}</div>
      ))}
    </div>
  )
}))
vi.mock("@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-tree-item", () => ({
  default: ({ node, selected, onActivate }: any) => (
    <button
      aria-pressed={selected}
      onClick={onActivate}
    >
      {node.name}
    </button>
  )
}))
afterEach(cleanup)
it("replaces the clicked Base selection after linked-file navigation and scrolls to the revealed note", () => {
  const viewport = document.createElement("div")
  viewport.scrollTo = vi.fn()
  const base = { name: "list.base", path: "/vault/list.base", type: "file" }
  const note = { name: "note.md", path: "/vault/note.md", type: "file" }
  const context = { workspace: { name: "vault", path: "/vault" }, openFiles: [base, note], activeFilePath: base.path, openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  const view = render(
    <WorkspaceContext.Provider value={context as any}>
      <WorkspaceTree
        recent
        viewport={viewport}
      />
    </WorkspaceContext.Provider>
  )
  fireEvent.click(screen.getByRole("button", { name: "list.base" }))
  expect(screen.getByRole("button", { name: "list.base" }).getAttribute("aria-pressed")).toBe("true")
  view.rerender(
    <WorkspaceContext.Provider value={{ ...context, activeFilePath: note.path } as any}>
      <WorkspaceTree
        recent
        viewport={viewport}
        revealPath={note.path}
      />
    </WorkspaceContext.Provider>
  )
  expect(screen.getByRole("button", { name: "list.base" }).getAttribute("aria-pressed")).toBe("false")
  expect(screen.getByRole("button", { name: "note.md" }).getAttribute("aria-pressed")).toBe("true")
  expect(viewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth" }))
})
