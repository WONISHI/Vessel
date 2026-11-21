import { act, waitFor, cleanup, fireEvent, render, screen } from "@testing-library/react"
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
afterEach(() => { cleanup(); vi.useRealTimers() })
it("prefetches only the hovered directory and renders its cached children immediately on expansion", async () => {
  const folder = { name: "src", path: "/prefetch/src", type: "directory" }
  const other = { name: "docs", path: "/prefetch/docs", type: "directory" }
  const child = { name: "index.ts", path: "/prefetch/src/index.ts", type: "file" }
  const read = vi.fn(async (_root: string, path: string) => path === "/prefetch" ? [folder, other] : [child])
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const context = { workspace: { name: "prefetch", path: "/prefetch" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [] as string[], setDirectoryExpanded: vi.fn() }
  const tree = (expandedFolders: string[]) => <WorkspaceContext.Provider value={{ ...context, expandedFolders } as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>
  const view = render(tree([]))
  expect(screen.queryByRole("status", { name: "正在加载目录" })).toBeNull()
  const row = await screen.findByRole("button", { name: "src" })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.pointerEnter(row.closest("[data-node-path]")!)
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  await act(async () => {})
  expect(read).toHaveBeenLastCalledWith("/prefetch", "/prefetch/src", { hideAttachmentFolders: true, metadata: false })
  view.rerender(tree([folder.path]))
  expect(screen.getByRole("button", { name: "index.ts" })).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
})

it("opens names without metadata and upgrades cached nodes when switching to time sorting", async () => {
  const nodes = [{ name: "a.ts", path: "/sort-fast/a.ts", type: "file" }, { name: "b.ts", path: "/sort-fast/b.ts", type: "file" }]
  const read = vi.fn(async (_root: string, _path: string, options: { metadata: boolean }) => options.metadata ? nodes.map((node, i) => ({ ...node, mtime: i === 0 ? 20 : 10 })) : nodes)
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const context = { workspace: { name: "sort-fast", path: "/sort-fast" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  const tree = (sortBy: "auto" | "mtime") => <WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} sortBy={sortBy} /></WorkspaceContext.Provider>
  const view = render(tree("auto"))
  await screen.findByRole("button", { name: "a.ts" })
  expect(read).toHaveBeenCalledExactlyOnceWith("/sort-fast", "/sort-fast", { hideAttachmentFolders: true, metadata: false })
  view.rerender(tree("mtime"))
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(read).toHaveBeenLastCalledWith("/sort-fast", "/sort-fast", { hideAttachmentFolders: true, metadata: true })
  await waitFor(() => expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["b.ts", "a.ts"]))
  view.rerender(tree("auto"))
  expect(screen.getAllByRole("button").map(button => button.textContent)).toEqual(["a.ts", "b.ts"])
  expect(read).toHaveBeenCalledTimes(2)
})

it("does not start hover prefetch requests while the file list is scrolling", async () => {
  const folder = { name: "src", path: "/scroll-prefetch/src", type: "directory" }
  const read = vi.fn(async (_root: string, path: string) => path === "/scroll-prefetch" ? [folder] : [])
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const viewport = document.createElement("div")
  const context = { workspace: { name: "scroll-prefetch", path: "/scroll-prefetch" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  render(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={viewport} /></WorkspaceContext.Provider>)
  const row = (await screen.findByRole("button", { name: "src" })).closest("[data-node-path]")!
  vi.useFakeTimers()
  fireEvent.pointerEnter(row)
  fireEvent.scroll(viewport)
  await act(async () => { vi.advanceTimersByTime(80) })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.pointerEnter(row)
  await act(async () => { vi.advanceTimersByTime(130) })
  expect(read).toHaveBeenCalledTimes(1)
  fireEvent.pointerEnter(row)
  await act(async () => { vi.advanceTimersByTime(80) })
  expect(read).toHaveBeenCalledTimes(2)
})
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
  expect(viewport.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: "instant" }))
})


it("keeps loaded rows mounted while a theme/settings change refreshes directories", async () => {
  const node = { name: "note.md", path: "/vault/note.md", type: "file" }
  let resolveRefresh: (nodes: any[]) => void = () => {}
  const read = vi.fn().mockResolvedValueOnce([node]).mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const context = { workspace: { name: "vault", path: "/vault" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  render(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>)
  await screen.findByRole("button", { name: "note.md" })
  act(() => { window.dispatchEvent(new Event("vessel:settings-saved")) })
  expect(screen.getByRole("button", { name: "note.md" })).toBeTruthy()
  await act(async () => { resolveRefresh([node]) })
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(screen.getByRole("button", { name: "note.md" })).toBeTruthy()
})

it("reuses cached directories without reloading when the sidebar is collapsed and re-expanded", async () => {
  const node = { name: "cached.md", path: "/vault/cached.md", type: "file" }
  const read = vi.fn().mockResolvedValue([node])
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const context = { workspace: { name: "vault", path: "/vault" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  const first = render(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>)
  await screen.findByRole("button", { name: "cached.md" })
  expect(read).toHaveBeenCalledTimes(1)
  first.unmount()

  render(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>)
  expect(screen.getByRole("button", { name: "cached.md" })).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(1)
})

it("refreshes in place without removing rows or the scroll viewport", async () => {
  const node = { name: "before.md", path: "/vault/before.md", type: "file" }
  let release!: (nodes: any[]) => void
  const read = vi.fn().mockResolvedValueOnce([node]).mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const context = { workspace: { name: "vault", path: "/vault" }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() }
  const view = render(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>)
  const row = await screen.findByRole("button", { name: "before.md" })
  view.rerender(<WorkspaceContext.Provider value={context as any}><WorkspaceTree viewport={null} refreshVersion={1} /></WorkspaceContext.Provider>)
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  expect(screen.getByRole("button", { name: "before.md" })).toBe(row)
  await act(async () => release([{ ...node, name: "after.md" }]))
  await screen.findByRole("button", { name: "after.md" })
})

it("keeps cached rows when switching among six resource projects", async () => {
  const read = vi.fn(async (root: string) => [{ name: `${root.slice(1)}.md`, path: `${root}/note.md`, type: "file" }])
  window.electronAPI = { ...window.electronAPI, readWorkspaceDirectory: read } as any
  const tree = (path: string) => <WorkspaceContext.Provider value={{ workspace: { name: path, path }, openFiles: [], activeFilePath: "", openWorkspaceFile: vi.fn(), expandedFolders: [], setDirectoryExpanded: vi.fn() } as any}><WorkspaceTree viewport={null} /></WorkspaceContext.Provider>
  for (let index = 0; index < 6; index++) {
    const view = render(tree(`/project-${index}`))
    await screen.findByRole("button", { name: `project-${index}.md` })
    view.unmount()
  }
  render(tree("/project-0"))
  expect(screen.getByRole("button", { name: "project-0.md" })).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(6)
})

