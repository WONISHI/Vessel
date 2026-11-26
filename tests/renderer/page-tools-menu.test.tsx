import { rememberOpenedResourceProject } from "@/pages/resources/opened-projects"
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
  sessionStorage.clear()
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
afterEach(() => { cleanup(); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals() })
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

it("lists every project opened in this window instead of recents and switches directly", async () => {
  rememberLibraryProject({ name: "仅历史记录", path: "/history-only" })
  for (let i = 1; i <= 7; i++) rememberOpenedResourceProject({ name: `项目${i}`, path: `/projects/${i}` })
  rememberOpenedResourceProject({ name: "项目4", path: "/projects/4" })
  mount("/resources/file")
  openMenu()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "切换项目" }), { key: "ArrowRight" })
  await screen.findByText("已打开的项目")
  expect(screen.queryByRole("menuitem", { name: "仅历史记录" })).toBeNull()
  expect(screen.getByRole("menuitem", { name: "项目1" })).toBeTruthy()
  expect(screen.getAllByRole("menuitem", { name: "项目4" })).toHaveLength(1)
  fireEvent.click(screen.getByRole("menuitem", { name: "项目6" }))
  await waitFor(() => expect(screen.getByLabelText("当前路由").textContent).toBe("/resources"))
  expect(JSON.parse(localStorage.getItem("resource_current_project")!)).toEqual({ name: "项目6", path: "/projects/6", files: [] })
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

it("starts with an empty switcher even when persistent recent projects exist", async () => {
  rememberLibraryProject({ name: "旧项目", path: "/old" })
  mount("/resources")
  openMenu()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "切换项目" }), { key: "ArrowRight" })
  expect(await screen.findByText("暂无已打开的项目")).toBeTruthy()
  expect(screen.queryByRole("menuitem", { name: "旧项目" })).toBeNull()
  expect(window.electronAPI.getRecentWorkspaces).not.toHaveBeenCalled()
})

it("opens another project from the system folder picker and records it in the library", async () => {
  window.electronAPI.openDirectory = vi.fn(async () => ({ name: "新项目", path: "/new-project", files: [] }))
  mount("/resources")
  openMenu()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "切换项目" }), { key: "ArrowRight" })
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

it("switches projects without a terminal interruption confirmation", async () => {
  localStorage.setItem("resource_current_project", JSON.stringify({ name: "Vessel", path: "/projects/Vessel", files: [] }))
  rememberOpenedResourceProject({ name: "Devly", path: "/projects/Devly" })
  mount("/resources/file")
  openMenu()
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "切换项目" }), { key: "ArrowRight" })
  fireEvent.click(await screen.findByRole("menuitem", { name: "Devly" }))
  await waitFor(() => expect(JSON.parse(localStorage.getItem("resource_current_project")!).path).toBe("/projects/Devly"))
  expect(screen.queryByRole("alertdialog")).toBeNull()
})

it("opens the active resource project in an external editor instead of the previous saved project", async () => {
  localStorage.setItem("resource_current_project", JSON.stringify({ name: "Vessel", path: "/projects/Vessel" }))
  window.electronAPI.openProjectInEditor = vi.fn().mockResolvedValue("VS Code")
  const provide = (event: Event) => {
    const callback = (event as CustomEvent).detail
    expect(callback.scope).toBe("resources")
    callback({ root: "/projects/Devly", files: [], openFile: vi.fn() })
  }
  window.addEventListener("vessel:request-workspace-files", provide)
  try {
    mount("/resources/file")
    openMenu()
    fireEvent.click(await screen.findByRole("menuitem", { name: "在编辑器中打开" }))
    expect(window.electronAPI.openProjectInEditor).toHaveBeenCalledExactlyOnceWith("/projects/Devly")
    expect(screen.getByLabelText("当前路由").textContent).toBe("/resources/file")
  } finally { window.removeEventListener("vessel:request-workspace-files", provide) }
})

it("offers external editor opening for the workspace and disables it without a project", () => {
  mount("/editor")
  openMenu()
  expect(screen.getByRole("menuitem", { name: "在编辑器中打开" }).getAttribute("aria-disabled")).toBe("true")
})


it("opens the existing API manual from help without offering workspace controls", async () => {
  mount("/api-client")
  openMenu()
  expect(screen.queryByRole("menuitem", { name: "打开控制台" })).toBeNull()
  fireEvent.click(screen.getByRole("menuitem", { name: "帮助", exact: true }))
  expect(await screen.findByRole("dialog", { name: "使用说明" })).toBeTruthy()
  expect(screen.getByText("Pre-request / Tests 脚本、环境变量与 pm 对象完整参考")).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull())
  expect(screen.getByRole("dialog", { name: "使用说明" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "知道了" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  openMenu()
  fireEvent.click(screen.getByRole("menuitem", { name: "帮助", exact: true }))
  expect(await screen.findByRole("dialog", { name: "使用说明" })).toBeTruthy()
})
