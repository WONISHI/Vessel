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
