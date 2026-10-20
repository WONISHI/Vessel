// @vitest-environment jsdom
import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { FileActions } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-actions"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { path: "/workspace" }, openFiles: [] }) }))
afterEach(cleanup)
it("keeps the file highlighted until its Radix context menu closes", () => {
  render(
    <FileActions
      node={{ name: "document.pdf", path: "/workspace/document.pdf", type: "file" }}
      onChanged={() => {}}
    >
      <button>document.pdf</button>
    </FileActions>
  )
  const row = screen.getByRole("button", { name: "document.pdf" })
  fireEvent.contextMenu(row)
  expect(screen.getByRole("menuitem", { name: "复制文件名" })).toBeTruthy()
  expect(row.parentElement?.className).toContain("!bg-[#f0efed]")
  fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })
  expect(screen.queryByRole("menu")).toBeNull()
  expect(row.parentElement?.className).not.toContain("!bg-[#f0efed]")
})
it("creates a typed file from the folder submenu", async () => {
  const create = vi.fn()
  render(<FileActions node={{ name: "notes", path: "/workspace/notes", type: "directory" }} onChanged={() => {}} onCreate={create}><button>notes</button></FileActions>)
  fireEvent.contextMenu(screen.getByRole("button", { name: "notes" }))
  const trigger = screen.getByRole("menuitem", { name: "新建文件" })
  trigger.focus()
  fireEvent.keyDown(trigger, { key: "ArrowRight" })
  expect(await screen.findByRole("menuitem", { name: "新建 MD 文件" })).toBeTruthy()
  expect(screen.getByRole("menuitem", { name: "新建白板 (.excalidraw.md)" })).toBeTruthy()
  fireEvent.click(screen.getByRole("menuitem", { name: "新建思维导图 (.mind)" }))
  expect(create).toHaveBeenCalledWith("file", "mind")
})

it("offers batch actions for a multi-selection and copies all selected names", async () => {
  const nodes = [{ name: "a.png", path: "/workspace/a.png", type: "file" as const }, { name: "b.png", path: "/workspace/b.png", type: "file" as const }]
  const writeText = vi.fn(async () => {})
  Object.assign(navigator, { clipboard: { writeText } })
  render(<FileActions node={nodes[0]} selectedNodes={nodes} onChanged={() => {}}><button>a.png</button></FileActions>)
  fireEvent.contextMenu(screen.getByRole("button", { name: "a.png" }))
  expect(screen.getByText("已选中 2 项")).toBeTruthy()
  expect(screen.queryByRole("menuitem", { name: "重命名" })).toBeNull()
  expect(screen.queryByRole("menuitem", { name: "在资源管理器中显示" })).toBeNull()
  fireEvent.click(screen.getByRole("menuitem", { name: "复制文件名" }))
  expect(writeText).toHaveBeenCalledWith("a.png\nb.png")
})
