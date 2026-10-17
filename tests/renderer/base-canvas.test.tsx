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
