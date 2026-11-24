// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { toast } from "sonner"
import { localFileURL } from '@vessel/utils'
import { FileActions } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-actions"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { path: "/workspace" }, openFiles: [] }) }))
beforeEach(() => { window.electronAPI = { ...window.electronAPI, getSettings: vi.fn(async () => ({})) } })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
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
  expect(screen.queryByRole("menuitem", { name: "在编辑器中打开" })).toBeNull()
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
  expect(screen.queryByRole("menuitem", { name: "在编辑器中打开" })).toBeNull()
  expect(screen.queryByRole("menuitem", { name: "重命名" })).toBeNull()
  expect(screen.queryByRole("menuitem", { name: "在资源管理器中显示" })).toBeNull()
  fireEvent.click(screen.getByRole("menuitem", { name: "复制文件名" }))
  expect(writeText).toHaveBeenCalledWith("a.png\nb.png")
})

it.each(['页面 #1.html', 'photo.PNG', 'document.pdf', 'data.json', 'clip.mp4'])('opens %s in the default browser with an encoded local URL', (name) => {
 const openExternal = vi.fn(async () => {})
 window.electronAPI = { ...window.electronAPI, openExternal, getSettings: vi.fn(async () => ({})) }
 const path = `/workspace/${name}`
 render(<FileActions node={{ name, path, type: 'file' }} onChanged={vi.fn()}><button>{name}</button></FileActions>)
 fireEvent.contextMenu(screen.getByRole('button', { name }))
 fireEvent.click(screen.getByRole('menuitem', { name: '在默认浏览器中打开' }))
 expect(openExternal).toHaveBeenCalledWith(localFileURL(path))
 expect(screen.queryByRole('menu')).toBeNull()
})

it.each([{ name: 'folder.html', type: 'directory' as const }, { name: 'app.exe', type: 'file' as const }, { name: 'report.docx', type: 'file' as const }, ...['notes.md', 'notes.markdown', 'drawing.excalidraw.md', 'table.csv'].map((name) => ({ name, type: 'file' as const }))])('hides browser opening for $name', (node) => {
 render(<FileActions node={{ ...node, path: `/workspace/${node.name}` }} onChanged={vi.fn()}><button>{node.name}</button></FileActions>)
 fireEvent.contextMenu(screen.getByRole('button', { name: node.name }))
 expect(screen.queryByRole('menuitem', { name: '在默认浏览器中打开' })).toBeNull()
})

it.each(["docs/工作计划 v2.md", "src/index.ts", "package.json"])("opens the selected file %s in the existing project editor", async (relativePath) => {
 const openProjectInEditor = vi.fn(async () => "VS Code")
 window.electronAPI = { ...window.electronAPI, openProjectInEditor }
 const path = `/workspace/${relativePath}`, name = relativePath.split("/").at(-1)!
 render(<FileActions node={{ name, path, type: "file" }} onChanged={vi.fn()}><button>{name}</button></FileActions>)
 fireEvent.contextMenu(screen.getByRole("button", { name }))
 fireEvent.click(screen.getByRole("menuitem", { name: "在编辑器中打开" }))
 expect(openProjectInEditor).toHaveBeenCalledExactlyOnceWith("/workspace", path)
 expect(screen.queryByRole("menu")).toBeNull()
})

it("reports editor launch failures instead of silently ignoring them", async () => {
 const error = vi.spyOn(toast, "error").mockImplementation(() => "error")
 window.electronAPI = { ...window.electronAPI, openProjectInEditor: vi.fn().mockRejectedValue(new Error("找不到编辑器")) }
 render(<FileActions node={{ name: "file.md", path: "/workspace/file.md", type: "file" }} onChanged={vi.fn()}><button>file.md</button></FileActions>)
 fireEvent.contextMenu(screen.getByRole("button", { name: "file.md" }))
 fireEvent.click(screen.getByRole("menuitem", { name: "在编辑器中打开" }))
 await vi.waitFor(() => expect(error).toHaveBeenCalledWith("Error: 找不到编辑器"))
})
