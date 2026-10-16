import React from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ProjectLibrary } from "@/components/workspace/components/layout-aside/project-library"
const navigate = vi.hoisted(() => vi.fn())
vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }))
vi.mock("@/components/workspace/hooks/useWorkspace", () => ({ useWorkspace: () => ({ workspace: { name: "Vessel", path: "/projects/Vessel" } }) }))
vi.mock("@/components/workspace/hooks/useWorkspaceController", () => ({ useWorkspaceController: (workspace: unknown) => ({ workspace }) }))
vi.mock("@/components/workspace/components/layout-aside/layout-workspace-sidebar/workspace-tree", () => ({ default: () => <div>目录树</div> }))
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
beforeEach(() => {
  localStorage.clear()
  localStorage.setItem("app_current_workspace", JSON.stringify({ path: "/work" }))
  Object.assign(window, {
    electronAPI: {
      getAppState: vi.fn().mockResolvedValue([{ name: "附件", path: "/projects/assets" }]),
      setAppState: vi.fn().mockResolvedValue(undefined),
      openDirectory: vi.fn().mockResolvedValue({ name: "新增项目", path: "/projects/new" })
    }
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it("switches preview projects without navigating or changing the workspace", async () => {
  render(
    <ProjectLibrary
      pinned={false}
      onPin={() => {}}
    />
  )
  fireEvent.click(await screen.findByText("附件"))
  expect(JSON.parse(localStorage.getItem("resource_current_project")!).path).toBe("/projects/assets")
  expect(JSON.parse(localStorage.getItem("app_current_workspace")!).path).toBe("/work")
  expect(navigate).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "固定资源库" }))
  expect(navigate).toHaveBeenCalledWith("/resources")
})
it("adds directories only to the resource library", async () => {
  render(
    <ProjectLibrary
      pinned={false}
      onPin={() => {}}
    />
  )
  await screen.findByText("附件")
  fireEvent.click(screen.getByRole("button", { name: "添加项目或附件目录" }))
  await waitFor(() => expect(JSON.parse(localStorage.getItem("resource_current_project")!).path).toBe("/projects/new"))
  expect(JSON.parse(localStorage.getItem("app_current_workspace")!).path).toBe("/work")
  expect(navigate).not.toHaveBeenCalled()
})
it("computes the pin state from the selected project, not the current page", async () => {
  localStorage.setItem("resource-library-meta", JSON.stringify({ pins: [{ name: "Vessel", path: "/projects/Vessel" }], lastPinned: { name: "Vessel", path: "/projects/Vessel" } }))
  render(
    <ProjectLibrary
      pinned
      onPin={() => {}}
    />
  )
  expect(screen.getByRole("button", { name: "取消固定资源库" })).toBeTruthy()
  fireEvent.click(await screen.findByText("附件"))
  expect(screen.getByRole("button", { name: "固定资源库" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "固定资源库" }))
  expect(JSON.parse(localStorage.getItem("resource-library-meta")!).lastPinned.path).toBe("/projects/assets")
})
