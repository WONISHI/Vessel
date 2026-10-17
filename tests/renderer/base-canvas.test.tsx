vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/core/canvas/variants/markdown/section-preview", () => ({ PreviewBody: ({ source }: { source: string }) => <div>{source}</div> }))
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import BaseCanvas from "@/components/core/canvas/variants/base"
import Canvas from "@/components/core/canvas"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import type { BaseQueryResult } from "@vessel/obsidian/bases"
vi.mock("@/components/core/canvas/variants/markdown/index", () => ({ default: () => null }))
vi.mock("@/components/core/canvas/variants/media/index", () => ({ default: () => null }))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("opens .base through the canvas, renders real query columns and switches views", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const result: BaseQueryResult = {
    viewIndex: 0,
    views: [
      { name: "所有", type: "table" },
      { name: "完成", type: "table" }
    ],
    columns: [
      { key: "file.name", label: "项目名称" },
      { key: "账号", label: "账号" }
    ],
    rows: [{ path: "notes/A.md", values: { "file.name": "A", 账号: "alice" } }],
    warnings: []
  }
  const queryBase = vi.fn(async (_root: string, _path: string, viewIndex?: number) => ({ ...result, viewIndex: viewIndex ?? 0 }))
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { queryBase } })
  const openWorkspaceFile = vi.fn()
  render(
    <WorkspaceContext.Provider value={{ openWorkspaceFile } as any}>
      <Canvas
        activeFilePath="/vault/list.base"
        fileType="base"
        workspacePath="/vault"
      />
    </WorkspaceContext.Provider>
  )
  expect(await screen.findByRole("columnheader", { name: "项目名称" })).toBeTruthy()
  expect(screen.getByRole("navigation", { name: "当前 Base 文件路径" }).textContent).toContain("list.base")
  expect(screen.getByRole("cell", { name: "alice" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "A" }))
  expect(openWorkspaceFile).toHaveBeenCalledWith({ name: "A.md", path: "/vault/notes/A.md", type: "file" })
  fireEvent.click(screen.getByRole("tab", { name: "完成" }))
  await waitFor(() => expect(queryBase).toHaveBeenCalledWith("/vault", "/vault/list.base", 1))
})
it("shows parse errors without falling back to an empty success table", async () => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      queryBase: vi.fn(async () => {
        throw new Error("YAML 错误")
      })
    }
  })
  render(
    <BaseCanvas
      activeFilePath="/vault/bad.base"
      workspacePath="/vault"
    />
  )
  expect((await screen.findByRole("alert")).textContent).toContain("YAML 错误")
  expect(screen.queryByRole("table")).toBeNull()
})

it("combines column searches and opens parsed wiki and external links", async () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  const readWikiLink = vi.fn(async () => ({ path: "/vault/notes/Project.md", content: "# 预览正文" }))
  const openExternal = vi.fn(async () => {})
  const copy = vi.fn(async () => {})
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: copy } })
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      readWikiLink,
      openExternal,
      queryBase: vi.fn(async () => ({
        viewIndex: 0,
        views: [{ name: "表格", type: "table" }],
        warnings: [],
        columns: [
          { key: "项目", label: "项目名称" },
          { key: "地址", label: "http地址" }
        ],
        rows: [
          { path: "A.md", values: { 项目: "[[notes/Project|项目甲]]", 地址: "1. https://example.com/a.git" } },
          { path: "B.md", values: { 项目: "项目乙", 地址: "https://example.com/b.git" } }
        ]
      }))
    }
  })
  const openWorkspaceFile = vi.fn()
  render(
    <WorkspaceContext.Provider value={{ openWorkspaceFile } as any}>
      <BaseCanvas
        activeFilePath="/vault/list.base"
        workspacePath="/vault"
      />
    </WorkspaceContext.Provider>
  )
  fireEvent.click(await screen.findByRole("link", { name: "项目甲" }))
  await waitFor(() => expect(openWorkspaceFile).toHaveBeenCalledWith({ name: "Project.md", path: "/vault/notes/Project.md", type: "file" }))
  expect(readWikiLink).toHaveBeenCalledWith("/vault", "notes/Project")
  fireEvent.click(screen.getByRole("link", { name: "https://example.com/a.git" }))
  await waitFor(() => expect(openExternal).toHaveBeenCalledWith("https://example.com/a.git"))
  fireEvent.contextMenu(screen.getByRole("link", { name: "https://example.com/a.git" }), { clientX: 50, clientY: 80 })
  expect(screen.getByRole("button", { name: "在默认浏览器中打开" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "在内置浏览器中打开" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "复制链接" }))
  await waitFor(() => expect(copy).toHaveBeenCalledWith("https://example.com/a.git"))
  fireEvent.click(screen.getByRole("button", { name: "筛选项目名称" }))
  fireEvent.change(screen.getByRole("textbox", { name: "搜索项目名称" }), { target: { value: "项目甲" } })
  expect(screen.queryByText("项目乙")).toBeNull()
  fireEvent.keyDown(screen.getByRole("textbox", { name: "搜索项目名称" }), { key: "Escape" })
  fireEvent.click(screen.getByRole("button", { name: "筛选http地址" }))
  fireEvent.change(screen.getByRole("textbox", { name: "搜索http地址" }), { target: { value: "b.git" } })
  expect(screen.queryByRole("link", { name: "项目甲" })).toBeNull()
  fireEvent.change(screen.getByRole("textbox", { name: "搜索http地址" }), { target: { value: "A.GIT" } })
  expect(screen.getByRole("link", { name: "项目甲" })).toBeTruthy()
  fireEvent.keyDown(screen.getByRole("textbox", { name: "搜索http地址" }), { key: "Escape" })
  fireEvent.mouseOver(screen.getByRole("link", { name: "项目甲" }))
  expect(readWikiLink).toHaveBeenCalledTimes(1)
  expect(await screen.findByText("# 预览正文", {}, { timeout: 3000 })).toBeTruthy()
  expect(readWikiLink).toHaveBeenCalledTimes(2)
})
