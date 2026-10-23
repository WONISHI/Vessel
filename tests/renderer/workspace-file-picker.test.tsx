import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { WorkspaceFilePicker } from "@/components/workspace-file-picker"

afterEach(() => {
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
  expect(searchContent).toHaveBeenCalledWith({ root: "/vault", query: "service", regex: false, caseSensitive: false })
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


it("keeps folders previously excluded by the picker and lets users reach results beyond the first 100", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const read = vi.fn(async (_root: string, path: string) => path === "/vault"
    ? [{ name: "node_modules", path: "/vault/node_modules", type: "directory" }]
    : Array.from({ length: 105 }, (_, i) => ({ name: `file-${i}.md`, path: `/vault/node_modules/file-${i}.md`, type: "file" })))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readWorkspaceDirectory: read, searchContent: vi.fn() } })
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files: [], openFile: vi.fn() }} onClose={() => {}} />)
  expect(await screen.findByText("继续向下滚动加载更多")).toBeTruthy()
  expect(read).toHaveBeenCalledWith("/vault", "/vault/node_modules", { includeIgnored: true })
  expect(screen.queryByRole("button", { name: /file-104.md/ })).toBeNull()
  const viewport = document.querySelector("[data-radix-scroll-area-viewport]")!
  Object.defineProperties(viewport, { scrollHeight: { configurable: true, value: 3000 }, clientHeight: { configurable: true, value: 300 }, scrollTop: { configurable: true, writable: true, value: 2700 } })
  expect(screen.getByRole("status").textContent).toContain("106 个结果")
  fireEvent.scroll(viewport)
  expect(screen.getByRole("button", { name: /file-104.md/ })).toBeTruthy()
  expect(screen.getByRole("status").textContent).toContain("已显示 106 个")
  fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "file-" } })
  expect(viewport.scrollTop).toBe(0)
  expect(screen.queryByRole("button", { name: /file-104.md/ })).toBeNull()
})

it("marks matching opened Markdown paths active without highlighting same-name files elsewhere", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  const opened = { name: "note.md", path: "/vault/open/note.md", type: "file" as const }
  const unopened = { name: "note.md", path: "/vault/other/note.md", type: "file" as const }
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    readWorkspaceDirectory: vi.fn(async () => [opened, unopened]),
    searchContent: vi.fn(async () => ({ matches: [], truncated: false }))
  } })
  render(<WorkspaceFilePicker workspace={{ root: "/vault", files: [opened], activePath: opened.path, openFile: vi.fn() }} onClose={() => {}} />)
  const row = await screen.findByRole("button", { name: /open\/note.md/ })
  expect(row.getAttribute("data-active")).toBe("true")
  expect(row.getAttribute("aria-current")).toBe("page")
  expect(row.textContent).toContain("已打开")
  const other = await screen.findByRole("button", { name: /other\/note.md/ })
  expect(other.hasAttribute("data-active")).toBe(false)
  fireEvent.change(screen.getByRole("textbox", { name: "搜索工作区文件" }), { target: { value: "note" } })
  expect(document.querySelectorAll('.workspace-file-picker-row[data-active="true"]')).toHaveLength(1)
})
