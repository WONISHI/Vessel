import { useState } from "react"
// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/editor", search: "" }) }))
vi.mock("@/components/ui/sidebar", () => ({ useSidebar: () => ({ open: true }), SidebarTrigger: () => <button>侧栏</button> }))
vi.mock("@/components/transit/button", () => ({ TransitButton: () => null }))
vi.mock("@/pages/resources/library-state", () => ({ selectLastPinned: vi.fn() }))
afterEach(cleanup)
it("runs whole-workspace sync from the home context menu without navigating", async () => {
  const runBackup = vi.fn(async () => ({ running: false }))
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      getSettings: vi.fn(async () => ({ backup: { enabled: true, workspacePath: "/notes" } })),
      getBackupStatus: vi.fn(async () => ({ running: false })),
      runBackup
    }
  })
  const change = vi.fn()
  render(
    <LayoutActivityBar
      activity="files"
      onActivityChange={change}
    />
  )
  await waitFor(() => expect(window.electronAPI.getSettings).toHaveBeenCalled())
  fireEvent.contextMenu(screen.getByRole("button", { name: "工作区" }))
  const item = screen.getByRole("menuitem", { name: "同步" })
  await waitFor(() => expect(item.getAttribute("aria-disabled")).not.toBe("true"))
  fireEvent.click(item)
  await waitFor(() => expect(runBackup).toHaveBeenCalledWith())
  expect(change).not.toHaveBeenCalled()
})

it("moves crowded activities into More and restores them when the rail grows", async () => {
  let height = 600
  let resize: (() => void) | undefined
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return { height: this.getAttribute("aria-label") === "工作台活动栏" ? height : 38, width: 52, x: 0, y: 0, top: 0, left: 0, bottom: height, right: 52, toJSON() {} } as DOMRect
  })
  vi.stubGlobal(
    "ResizeObserver",
    class {
      callback: () => void
      constructor(callback: () => void) {
        this.callback = callback
      }
      observe(element: Element) {
        if (element.getAttribute("aria-label") === "工作台活动栏") resize = this.callback
      }
      disconnect() {}
      unobserve() {}
    }
  )
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { getSettings: vi.fn(async () => ({ backup: {} })), getBackupStatus: vi.fn(async () => ({})) } })
  const change = vi.fn()
  try {
    render(
      <LayoutActivityBar
        activity="files"
        onActivityChange={change}
      />
    )
    expect(screen.getByRole("button", { name: "图片" })).toBeTruthy()
    act(() => {
      height = 300
      resize?.()
    })
    expect(screen.queryByRole("button", { name: "图片" })).toBeNull()
    expect(screen.getByRole("button", { name: "工作区" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "更多开发工具" }))
    fireEvent.click(await screen.findByRole("button", { name: "图片" }))
    expect(change).toHaveBeenCalledWith("image")
    act(() => {
      height = 600
      resize?.()
    })
    expect(screen.getByRole("button", { name: "图片" })).toBeTruthy()
  } finally {
    vi.unstubAllGlobals()
  }
})

it("restores the workspace active state after choosing Git from More", async () => {
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { getSettings: vi.fn(async () => ({ backup: {} })), getBackupStatus: vi.fn(async () => ({})) } })
  const Harness = () => {
    const [activity, setActivity] = useState<"files" | "git">("files")
    return (
      <LayoutActivityBar
        activity={activity}
        onActivityChange={(value) => setActivity(value as "files" | "git")}
      />
    )
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "更多开发工具" }))
  fireEvent.click(await screen.findByRole("button", { name: /Git 代码版本管理/ }))
  expect(screen.getByRole("button", { name: "更多开发工具" }).getAttribute("aria-pressed")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "工作区" }))
  expect(screen.getByRole("button", { name: "工作区" }).getAttribute("aria-pressed")).toBe("true")
  expect(screen.getByRole("button", { name: "更多开发工具" }).getAttribute("aria-pressed")).toBe("false")
})

it("switches dark and light appearance from the activity bar without changing other settings", async () => {
  const { defaultSettings } = await import("@vessel/utils")
  const settings = structuredClone(defaultSettings)
  const saveSettings = vi.fn(async (next) => next)
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      getSettings: vi.fn(async () => settings),
      saveSettings,
      getBackupStatus: vi.fn(async () => ({ running: false }))
    }
  })
  document.documentElement.classList.remove("dark")
  render(
    <LayoutActivityBar
      activity="files"
      onActivityChange={() => {}}
    />
  )
  fireEvent.click(screen.getByRole("button", { name: "切换浅色或深色主题" }))
  await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(true))
  expect(saveSettings).toHaveBeenLastCalledWith({ ...settings, theme: "dark" })
  fireEvent.click(screen.getByRole("button", { name: "切换浅色或深色主题" }))
  await waitFor(() => expect(document.documentElement.classList.contains("dark")).toBe(false))
  expect(saveSettings).toHaveBeenLastCalledWith({ ...settings, theme: "light" })
})

it("does not restore the More tooltip when its hover popover closes", async () => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { getSettings: vi.fn(async () => ({ backup: {} })), getBackupStatus: vi.fn(async () => ({})) } })
  render(<LayoutActivityBar activity="files" onActivityChange={() => {}} />)
  const trigger = screen.getByRole("button", { name: "更多开发工具" })
  fireEvent.mouseEnter(trigger.parentElement!)
  expect(await screen.findByRole("button", { name: /Git 代码版本管理/ })).toBeTruthy()
  fireEvent.pointerLeave(trigger, { pointerType: "mouse" })
  fireEvent.mouseLeave(trigger.parentElement!)
  await waitFor(() => expect(screen.queryByRole("button", { name: /Git 代码版本管理/ })).toBeNull())
  expect(screen.queryByRole("tooltip", { name: /更多工具/ })).toBeNull()
})
