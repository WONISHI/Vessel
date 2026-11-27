import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { LayoutVisibilityControls } from "@/components/layout/layout-visibility-controls"
import { StatusBar } from "@/components/ui/status-bar"
import { setActivityBarCollapsed, useActivityBarCollapsed } from "@/features/activity-bar/collapse"
import { setStatusBarVisible } from "@/features/status-bar/visibility"
import { initializeLayoutPreferences } from "@/features/layout/preferences"
import type { LayoutPreferences } from '@vessel/type/layout-preferences'

function ActivityRegion() {
  return useActivityBarCollapsed() ? null : <nav aria-label="工作台活动栏" />
}

let changed: (value: LayoutPreferences) => void
const save = vi.fn().mockResolvedValue(undefined)
beforeEach(async () => {
  vi.stubGlobal('electronAPI', { layoutPreferences: { get: async () => ({ activityBarCollapsed: false, statusBarVisible: true }), set: save, onChanged: (callback: typeof changed) => { changed = callback; return () => {} } } })
  await initializeLayoutPreferences()
  setActivityBarCollapsed(false); setStatusBarVisible(true); save.mockClear()
})
afterEach(() => { cleanup(); setActivityBarCollapsed(false); setStatusBarVisible(true); vi.unstubAllGlobals(); localStorage.clear() })

it("keeps the title bar controls available to hide and restore both layout regions", () => {
  render(<><LayoutVisibilityControls /><ActivityRegion /><StatusBar left="工作区" /></>)
  fireEvent.click(screen.getByRole("button", { name: "隐藏活动栏" }))
  expect(screen.queryByLabelText("工作台活动栏")).toBeNull()
  expect(screen.getByLabelText("显示活动栏").querySelector(".codicon-layout-sidebar-left-off")).toBeTruthy()
  expect(save).toHaveBeenCalledWith({ activityBarCollapsed: true })
  expect(localStorage.getItem("vessel-activity-bar-collapsed")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "隐藏底部状态栏" }))
  expect(screen.queryByLabelText("底部状态栏")).toBeNull()
  expect(screen.getByLabelText("显示底部状态栏").getAttribute("aria-pressed")).toBe("false")
  expect(screen.getByLabelText("显示底部状态栏").querySelector(".codicon-layout-panel-off")).toBeTruthy()
  expect(save).toHaveBeenCalledWith({ statusBarVisible: false })
  expect(localStorage.getItem("vessel-status-bar-visible")).toBeNull()
  fireEvent.click(screen.getByLabelText("显示活动栏"))
  fireEvent.click(screen.getByLabelText("显示底部状态栏"))
  expect(screen.getByLabelText("工作台活动栏")).toBeTruthy()
  expect(screen.getByLabelText("底部状态栏")).toBeTruthy()
})

it("hides all mounted status bars and preserves the choice when changing pages", () => {
  const view = render(<><LayoutVisibilityControls /><StatusBar left="浏览器" /><StatusBar left="中转站" /></>)
  expect(screen.getAllByLabelText("底部状态栏")).toHaveLength(2)
  fireEvent.click(screen.getByLabelText("隐藏底部状态栏"))
  expect(screen.queryAllByLabelText("底部状态栏")).toHaveLength(0)
  view.rerender(<><LayoutVisibilityControls /><StatusBar key="resources" left="项目资源库" /></>)
  expect(screen.queryByLabelText("底部状态栏")).toBeNull()
  fireEvent.click(screen.getByLabelText("显示底部状态栏"))
  expect(screen.getByText("项目资源库")).toBeTruthy()
})

it("syncs both choices from Node store and keeps them when browser storage is cleared", () => {
  render(<><LayoutVisibilityControls activity={false} /><StatusBar /></>)
  expect(screen.queryByLabelText("隐藏活动栏")).toBeNull()
  act(() => {
    changed({ activityBarCollapsed: true, statusBarVisible: false })
  })
  expect(screen.queryByLabelText("底部状态栏")).toBeNull()
  act(() => {
    localStorage.clear()
    window.dispatchEvent(new StorageEvent("storage", { key: null }))
  })
  expect(screen.queryByLabelText("底部状态栏")).toBeNull()
  act(() => { changed({ activityBarCollapsed: false, statusBarVisible: true }) })
  expect(screen.getByLabelText("底部状态栏")).toBeTruthy()
})
