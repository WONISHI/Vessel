import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ProjectLibrary } from "@/components/workspace/components/layout-aside/project-library/components/project-library"
vi.mock("@/components/workspace/components/layout-aside/project-library/components/project-preview", () => ({ ProjectPreview: ({ project }: { project: { name: string } }) => <div>{project.name}</div> }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })

it("does not seed an empty project library from the workspace or stale selection", async () => {
  localStorage.setItem("resource_current_project", JSON.stringify({ name: "obsidian", path: "/notes" }))
  localStorage.setItem("app_current_workspace", JSON.stringify({ name: "obsidian", path: "/notes" }))
  const setAppState = vi.fn()
  vi.stubGlobal("electronAPI", { getAppState: vi.fn().mockResolvedValue([]), setAppState })
  render(<ProjectLibrary pinned={false} onPin={vi.fn()} />)
  await screen.findByText("还没有项目目录")
  expect(screen.queryByText("obsidian")).toBeNull()
  expect(setAppState).not.toHaveBeenCalled()
})
it("retains explicitly saved projects", async () => {
  vi.stubGlobal("electronAPI", { getAppState: vi.fn().mockResolvedValue([{ name: "My project", path: "/project" }]) })
  render(<ProjectLibrary pinned={false} onPin={vi.fn()} />)
  await waitFor(() => expect(screen.getByText("My project")).toBeTruthy())
})
