import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { MemoryRouter, useLocation } from "react-router-dom"
import { PageToolsMenu } from "@/components/layout/page-tools-menu"
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar"
import { readLibraryMeta, rememberLibraryProject } from "@/pages/resources/library-state"
import { refreshRecentResourceProjects } from "@/pages/resources/open-project"
import { projectCache } from "@/components/workspace/components/layout-aside/project-library/components/project-library-shared"

vi.mock("@/components/ui/sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
beforeEach(() => {
  localStorage.clear()
  projectCache.projects = null
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  HTMLElement.prototype.scrollIntoView = vi.fn()
  window.electronAPI = {
    getSettings: vi.fn(async () => ({ backup: { enabled: true, workspacePath: "/workspace" } })),
    getBackupStatus: vi.fn(async () => ({ running: false })),
    runBackup: vi.fn(async () => ({ running: false })),
    getAppState: vi.fn(async () => []), setAppState: vi.fn(async () => {}),
    getRecentWorkspaces: vi.fn(async () => []), openDirectory: vi.fn(async () => null)
  } as any
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
const openMenu = () => fireEvent.keyDown(screen.getByRole("button", { name: "页面工具" }), { key: "Enter" })
function mount(path: string) {
  function Location() { return <output aria-label="当前路由">{useLocation().pathname}</output> }
  return render(<MemoryRouter initialEntries={[path]}><PageToolsMenu browser={path === "/browser"} /><Location /></MemoryRouter>)
}

it("syncs the whole workspace and disables the menu item until completion", async () => {
  let finish!: (value: { running: boolean }) => void
  const run = vi.fn(() => new Promise<{ running: boolean }>(resolve => { finish = resolve }))
  window.electronAPI.runBackup = run
  mount("/editor/file")
  openMenu()
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).not.toBe("true"))
  fireEvent.click(screen.getByRole("menuitem", { name: "同步" }))
  expect(run).toHaveBeenCalledExactlyOnceWith(undefined, "/workspace")
  openMenu()
  expect(screen.getByRole("menuitem", { name: "正在同步…" }).getAttribute("aria-disabled")).toBe("true")
  fireEvent.click(screen.getByRole("menuitem", { name: "正在同步…" }))
  expect(run).toHaveBeenCalledOnce()
  await act(async () => finish({ running: false }))
  await waitFor(() => expect(screen.getByRole("button", { name: "页面工具" }).getAttribute("aria-expanded")).toBe("false"))
  openMenu()
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).not.toBe("true"))
})

it("follows external sync state and keeps sync disabled without configuration", async () => {
  mount("/editor")
  openMenu()
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).not.toBe("true"))
  act(() => window.dispatchEvent(new CustomEvent("vessel:sync-status", { detail: { running: true } })))
  expect(screen.getByRole("menuitem", { name: "正在同步…" }).getAttribute("aria-disabled")).toBe("true")
  window.electronAPI.getSettings = vi.fn(async () => ({ backup: { enabled: false } })) as any
  act(() => window.dispatchEvent(new Event("vessel:settings-saved")))
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).toBe("true"))
})

it("allows retrying sync after the previous request fails", async () => {
  const run = vi.fn().mockRejectedValueOnce(new Error("sync failed")).mockResolvedValue({ running: false })
  window.electronAPI.runBackup = run
  mount("/editor")
  openMenu()
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).not.toBe("true"))
  fireEvent.click(screen.getByRole("menuitem", { name: "同步" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "页面工具" }).getAttribute("aria-expanded")).toBe("false"))
  openMenu()
  await waitFor(() => expect(screen.getByRole("menuitem", { name: "同步" }).getAttribute("aria-disabled")).not.toBe("true"))
  fireEvent.click(screen.getByRole("menuitem", { name: "同步" }))
  await waitFor(() => expect(run).toHaveBeenCalledTimes(2))
})

it("keeps the five most recently opened projects and reopens a selection through the submenu", async () => {
  for (let i = 1; i <= 7; i++) rememberLibraryProject({ name: `项目${i}`, path: `/projects/${i}` })
  rememberLibraryProject({ name: "项目4", path: "/projects/4" })
  expect(readLibraryMeta().recent?.map(item => item.name)).toEqual(["项目4", "项目7", "项目6", "项目5", "项目3"])
  mount("/resources/file")
  openMenu()
  expect(screen.queryByRole("menuitem", { name: "同步" })).toBeNull()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "打开项目" }), { key: "ArrowRight" })
  await screen.findByText("最近打开的项目")
  expect(screen.queryByRole("menuitem", { name: "项目2" })).toBeNull()
  fireEvent.click(screen.getByRole("menuitem", { name: "项目6" }))
  await waitFor(() => expect(screen.getByLabelText("当前路由").textContent).toBe("/resources"))
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual({ name: "项目6", path: "/projects/6", files: [] })
  expect(readLibraryMeta().recent?.[0].path).toBe("/projects/6")
  expect(window.electronAPI.setAppState).toHaveBeenCalledWith("project-library", [{ name: "项目6", path: "/projects/6" }])
})

it("opens another project from the system folder picker and records it in the library", async () => {
  window.electronAPI.openDirectory = vi.fn(async () => ({ name: "新项目", path: "/new-project", files: [] }))
  mount("/resources")
  openMenu()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "打开项目" }), { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "打开其他项目…" }))
  await waitFor(() => expect(readLibraryMeta().recent?.[0].path).toBe("/new-project"))
  expect(window.electronAPI.openDirectory).toHaveBeenCalledOnce()
  expect(projectCache.projects).toEqual([{ name: "新项目", path: "/new-project" }])
})

it("seeds existing history from available resource projects without including editor-only workspaces", async () => {
  window.electronAPI.getAppState = vi.fn(async () => [{ name: "项目A", path: "/a" }, { name: "项目B", path: "/b" }]) as any
  window.electronAPI.getRecentWorkspaces = vi.fn(async () => [
    { name: "工作区", path: "/editor", isAvailable: true, lastOpenedAt: "2026-11-21T10:00:00Z" },
    { name: "项目A", path: "/a", isAvailable: true, lastOpenedAt: "2026-11-20T10:00:00Z" },
    { name: "项目B", path: "/b", isAvailable: true, lastOpenedAt: "2026-11-21T09:00:00Z" }
  ]) as any
  await refreshRecentResourceProjects()
  expect(readLibraryMeta().recent?.map(item => item.path)).toEqual(["/b", "/a"])
})

it("closes and reopens the visible page sidebar without changing hidden cached pages", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  function State({ label }: { label: string }) {
    return <output data-testid={label}>{useSidebar().open ? "open" : "closed"}</output>
  }
  render(<MemoryRouter initialEntries={["/resources/file"]}>
    <PageToolsMenu browser={false} />
    <SidebarProvider><State label="visible-sidebar" /></SidebarProvider>
    <div hidden><SidebarProvider><State label="cached-sidebar" /></SidebarProvider></div>
  </MemoryRouter>)
  openMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: "关闭侧边栏" }))
  expect(screen.getByTestId("visible-sidebar").textContent).toBe("closed")
  expect(screen.getByTestId("cached-sidebar").textContent).toBe("open")
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
  openMenu()
  fireEvent.click(await screen.findByRole("menuitem", { name: "打开侧边栏" }))
  expect(screen.getByTestId("visible-sidebar").textContent).toBe("open")
})

it("confirms a project switch and leaves the current project and route untouched on cancellation", async () => {
  const current = { name: "Vessel", path: "/projects/Vessel", files: [] }
  localStorage.setItem("resource_current_project", JSON.stringify(current))
  rememberLibraryProject({ name: "Devly", path: "/projects/Devly" })
  mount("/resources/file")
  const choose = async () => {
    openMenu()
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "打开项目" }), { key: "ArrowRight" })
    fireEvent.click(await screen.findByRole("menuitem", { name: "Devly" }))
    await screen.findByRole("alertdialog", { name: "切换项目？" })
  }
  await choose()
  expect(screen.getByText(/可能中断当前终端中正在运行的命令或请求/)).toBeTruthy()
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual(current)
  fireEvent.click(screen.getByRole("button", { name: "取消", exact: true }))
  expect(screen.getByLabelText("当前路由").textContent).toBe("/resources/file")
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual(current)
  expect(window.electronAPI.setAppState).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  await choose()
  fireEvent.click(screen.getByRole("button", { name: "切换项目", exact: true }))
  await waitFor(() => expect(JSON.parse(localStorage.getItem("resource_current_project")!).path).toBe("/projects/Devly"))
  expect(screen.getByLabelText("当前路由").textContent).toBe("/resources")
})
