import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { setFileIconSettings } from "@/features/file-icons/state"
import { WorkspaceFilePicker } from "@/components/workspace-file-picker"

beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  setFileIconSettings({})
  cleanup()
  vi.unstubAllGlobals()
})

it("lists current tabs first and searches filenames plus contained links before opening a result", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const searchContent = vi.fn(async () => ({ matches: [{ path: "/vault/notes/linked.md", relativePath: "notes/linked.md", text: "https://service.example/task", line: 1, column: 1, ranges: [] }], truncated: false }))
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      readWorkspaceDirectory: vi.fn(async () => [{ name: "service.md", path: "/vault/service.md", type: "file" }]),
      searchContent
    }
  })
  const openFile = vi.fn()
  const close = vi.fn()
  render(
    <WorkspaceFilePicker
      workspace={{ root: "/vault", files: [{ name: "open.md", path: "/vault/open.md", type: "file" }], openFile }}
      onClose={close}
    />
  )
  expect(screen.getByRole("button", { name: /open.md/ })).toBeTruthy()
  expect(searchContent).not.toHaveBeenCalled()
  expect(await screen.findByRole("button", { name: /service.md/ })).toBeTruthy()
  expect(screen.getByRole("status").textContent).toContain("2 个结果")
  fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "service" } })
  expect(await screen.findByRole("button", { name: /service.md/ })).toBeTruthy()
  fireEvent.click(await screen.findByRole("button", { name: /linked.md/ }))
  await waitFor(() => expect(openFile).toHaveBeenCalledWith({ name: "linked.md", path: "/vault/notes/linked.md", type: "file" }))
  expect(searchContent).toHaveBeenCalledWith({ root: "/vault", query: "service", regex: false, caseSensitive: false, exclude: "**/node_modules/**,**/.git/**" })
  expect(close).toHaveBeenCalledTimes(1)
})

it("searches folders and reveals the selected folder without opening it as a file", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      readWorkspaceDirectory: vi.fn(async (_root: string, path: string) => (path === "/vault" ? [{ name: "项目资料", path: "/vault/项目资料", type: "directory" }] : [])),
      searchContent: vi.fn(async () => ({ matches: [], truncated: false }))
    }
  })
  const reveal = vi.fn()
  const openFile = vi.fn()
  window.addEventListener("vessel:reveal-file", reveal)
  try {
    render(
      <WorkspaceFilePicker
        workspace={{ root: "/vault", files: [], openFile }}
        onClose={() => {}}
      />
    )
    fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "项目资料" } })
    fireEvent.click(await screen.findByRole("button", { name: /项目资料/ }))
    expect(reveal.mock.calls[0][0].detail).toBe("/vault/项目资料")
    expect(openFile).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener("vessel:reveal-file", reveal)
  }
})

it("indexes unopened nested files before typing and opens them", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const read = vi.fn(async (_root: string, path: string) => path === "/vault"
    ? [{ name: "notes", path: "/vault/notes", type: "directory" }]
    : [{ name: "unopened.md", path: "/vault/notes/unopened.md", type: "file" }])
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWorkspaceDirectory: read, searchContent: vi.fn() } })
  const openFile = vi.fn()
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files: [], openFile }} onClose={() => {}} />)
  fireEvent.click(await screen.findByRole("button", { name: /unopened.md/ }))
  expect(read).toHaveBeenCalledWith("/vault", "/vault/notes", { includeIgnored: true })
  expect(openFile).toHaveBeenCalledWith({ name: "unopened.md", path: "/vault/notes/unopened.md", type: "file" })
})


it("keeps total scroll height stable and virtualizes results beyond the first 100 files", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const read = vi.fn(async (_root: string, path: string) => path === "/vault"
    ? [{ name: "notes", path: "/vault/notes", type: "directory" }]
    : Array.from({ length: 105 }, (_, i) => ({ name: `file-${i}.md`, path: `/vault/notes/file-${i}.md`, type: "file" })))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWorkspaceDirectory: read, searchContent: vi.fn() } })
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files: [], openFile: vi.fn() }} onClose={() => {}} />)
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("106 个结果"))
  expect(document.querySelector("[data-virtual-quick-results]")?.getAttribute("style")).toContain("3180px")
  expect(document.querySelectorAll(".workspace-file-picker-row").length).toBeLessThan(40)
  expect(read).toHaveBeenCalledWith("/vault", "/vault/notes", { includeIgnored: true })
  expect(screen.queryByRole("button", { name: /file-104.md/ })).toBeNull()
  const viewport = document.querySelector("[data-radix-scroll-area-viewport]")!
  Object.defineProperties(viewport, { scrollHeight: { configurable: true, value: 3180 }, clientHeight: { configurable: true, value: 300 }, scrollTop: { configurable: true, writable: true, value: 2880 } })
  expect(screen.getByRole("status").textContent).toContain("106 个结果")
  fireEvent.scroll(viewport)
  expect(screen.getByRole("button", { name: /file-104.md/ })).toBeTruthy()
  expect(viewport.scrollTop).toBe(2880)
  expect(document.querySelector("[data-virtual-quick-results]")?.getAttribute("style")).toContain("3180px")
  expect(document.querySelectorAll(".workspace-file-picker-row").length).toBeLessThan(40)
  fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "file-" } })
  expect(viewport.scrollTop).toBe(0)
  expect(screen.queryByRole("button", { name: /file-104.md/ })).toBeNull()
})

it("marks only the current tab active while retaining opened markers on other tabs", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const opened = { name: "note.md", path: "/vault/open/note.md", type: "file" as const }
  const unopened = { name: "note.md", path: "/vault/other/note.md", type: "file" as const }
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    readWorkspaceDirectory: vi.fn(async () => [opened, unopened]),
    searchContent: vi.fn(async () => ({ matches: [], truncated: false }))
  } })
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files: [opened, unopened], activePath: opened.path, openFile: vi.fn() }} onClose={() => {}} />)
  const row = await screen.findByRole("button", { name: /open\/note.md/ })
  expect(row.getAttribute("data-active")).toBe("true")
  expect(row.getAttribute("aria-current")).toBe("page")
  expect(row.textContent).toContain("已打开")
  const other = await screen.findByRole("button", { name: /other\/note.md/ })
  expect(other.hasAttribute("data-active")).toBe(false)
  expect(other.textContent).toContain("已打开")
  fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "note" } })
  expect(document.querySelectorAll('.workspace-file-picker-row[data-active="true"]')).toHaveLength(1)
})

it("navigates results with arrow keys and opens the selected file with Enter", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const files = [{ name: "first.md", path: "/vault/first.md", type: "file" as const }, { name: "second.md", path: "/vault/second.md", type: "file" as const }]
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWorkspaceDirectory: vi.fn(async () => files) } })
  const openFile = vi.fn()
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files, activePath: files[0].path, openFile }} onClose={vi.fn()} />)
  const input = screen.getByRole("textbox", { name: "搜索工作区文件" })
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(screen.getByRole("button", { name: /first.md/ }).getAttribute("data-keyboard-selected")).toBe("true")
  fireEvent.keyDown(input, { key: "ArrowDown" })
  expect(screen.getByRole("button", { name: /second.md/ }).getAttribute("data-keyboard-selected")).toBe("true")
  expect(screen.getByRole("button", { name: /second.md/ }).hasAttribute("data-active")).toBe(false)
  fireEvent.keyDown(input, { key: "Enter" })
  expect(openFile).toHaveBeenCalledWith(files[1])
})

it('excludes dependency files from indexing, open tabs and content matches', async () => {
  const read = vi.fn(async (_root: string, path: string) => path === '/vault'
    ? [{ name: 'node_modules', path: '/vault/node_modules', type: 'directory' }, { name: 'src', path: '/vault/src', type: 'directory' }]
    : [{ name: 'app.ts', path: '/vault/src/app.ts', type: 'file' }])
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { readWorkspaceDirectory: read, searchContent: vi.fn(async () => ({ matches: [{ path: '/vault/node_modules/dependency.ts' }, { path: '/vault/src/needle.ts' }], truncated: false })) } })
  render(<WorkspaceFilePicker workspace={{ root: '/vault', files: [{ name: 'opened-dependency.ts', path: '/vault/node_modules/opened-dependency.ts', type: 'file' }], openFile: vi.fn() }} onClose={() => {}} />)
  expect(await screen.findByRole('button', { name: /app.ts/ })).toBeTruthy()
  expect(read).not.toHaveBeenCalledWith('/vault', '/vault/node_modules', expect.anything())
  expect(screen.queryByText('opened-dependency.ts')).toBeNull()
  fireEvent.change(screen.getByLabelText('搜索工作区文件'), { target: { value: 'needle' } })
  expect(await screen.findByRole('button', { name: /needle.ts/ })).toBeTruthy()
  expect(screen.queryByText('dependency.ts')).toBeNull()
})


it.each(["workspace", "resources"] as const)("uses the %s tree icon theme and shows keyboard guidance", async (scope) => {
  setFileIconSettings({ fileIconTheme: "material", fileIconWorkspace: scope === "workspace", fileIconResources: scope === "resources" })
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWorkspaceDirectory: vi.fn(async () => []), searchContent: vi.fn() } })
  const { container } = render(<WorkspaceFilePicker workspace={{ scope, root: "/vault", files: [{ name: "App.vue", path: "/vault/App.vue", type: "file" }], openFile: vi.fn() }} onClose={() => {}} />)
  expect(container.ownerDocument.querySelector('img[data-file-icon-theme="material"]')?.getAttribute("src")).toContain("/material/vue.svg")
  expect(screen.getByText("打开文件")).toBeTruthy()
  expect(screen.getByText("esc")).toBeTruthy()
  expect(document.querySelector(".workspace-picker-results")?.className).not.toContain("-mx-4")
})

it('binds scrolling for a large list already present when the picker first mounts', async () => {
  Object.defineProperty(window, 'electronAPI', { configurable: true, value: { readWorkspaceDirectory: vi.fn(async () => []), searchContent: vi.fn() } })
  render(<WorkspaceFilePicker workspace={{ root: '/vault', files: Array.from({ length: 5000 }, (_, index) => ({ name: `note-${index}.md`, path: `/vault/note-${index}.md`, type: 'file' as const })), openFile: vi.fn() }} onClose={() => {}} />)
  const viewport = document.querySelector('[data-radix-scroll-area-viewport]')!
  Object.defineProperties(viewport, { clientHeight: { configurable: true, value: 240 }, scrollTop: { configurable: true, writable: true, value: 90000 } })
  fireEvent.scroll(viewport)
  expect(await screen.findByRole('button', { name: /note-3000.md/ })).toBeTruthy()
  expect(document.querySelectorAll('.workspace-file-picker-row').length).toBeLessThan(60)
  expect(document.querySelector('[data-virtual-quick-results]')?.getAttribute('style')).toContain('150000px')
})

it.each(['workspace', 'resources'] as const)('creates a custom file beside the active %s tab and closes immediately', async (scope) => {
 const createWorkspaceEntry = vi.fn(async () => ({ name: 'notes.txt', path: '/vault/sub/notes.txt', type: 'file' as const }))
 Object.defineProperty(window, 'electronAPI', { configurable: true, value: {
  createWorkspaceEntry,
  readWorkspaceDirectory: vi.fn(async () => []),
  searchContent: vi.fn(async () => ({ matches: [], truncated: false }))
 } })
 const openFile = vi.fn()
 const close = vi.fn()
 render(<WorkspaceFilePicker workspace={{ scope, root: '/vault', activePath: '/vault/sub/current.md', files: [], openFile }} onClose={close} />)
 expect(screen.queryByRole('button', { name: '新增自定义文件' })).toBeNull()
 fireEvent.change(screen.getByLabelText('搜索工作区文件'), { target: { value: 'notes.txt' } })
 fireEvent.click(screen.getByRole('button', { name: '新增自定义文件' }))
 expect(close).toHaveBeenCalledOnce()
 expect(createWorkspaceEntry).toHaveBeenCalledWith('/vault', '/vault/sub', 'notes.txt', 'file')
 await waitFor(() => expect(openFile).toHaveBeenCalledWith({ name: 'notes.txt', path: '/vault/sub/notes.txt', type: 'file' }))
})
