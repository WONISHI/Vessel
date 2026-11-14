import React, { useState } from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it } from "vitest"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope, setFileIconSettings } from "@/features/file-icons/state"
import { FileIconSettings } from "@/pages/settings/components/file-icon-settings"
import { defaultSettings } from "@vessel/utils"
beforeEach(() => setFileIconSettings({}))
afterEach(cleanup)
it("keeps current icons by default and independently applies a library to resources and workspaces", () => {
  const result = render(<><FileIconScope.Provider value="resources"><FileThemeIcon name="src/App.vue" fallback={<span>resource-default</span>} /></FileIconScope.Provider><FileIconScope.Provider value="workspace"><FileThemeIcon name="src/App.vue" fallback={<span>workspace-default</span>} /></FileIconScope.Provider></>)
  expect(result.getByText("resource-default")).toBeTruthy()
  expect(result.getByText("workspace-default")).toBeTruthy()
  act(() => setFileIconSettings({ fileIconTheme: "catppuccin" }))
  expect(result.queryByText("resource-default")).toBeNull()
  expect(result.getByText("workspace-default")).toBeTruthy()
  expect(result.container.querySelector('img')?.getAttribute('src')).toContain('/catppuccin/latte/vue.svg')
  act(() => setFileIconSettings({ fileIconTheme: "symbols", fileIconWorkspace: true, fileIconResources: false }))
  expect(result.getByText("resource-default")).toBeTruthy()
  expect(result.queryByText("workspace-default")).toBeNull()
  expect(result.container.querySelector('img')?.getAttribute('data-file-icon-theme')).toBe('symbols')
  act(() => setFileIconSettings({ fileIconTheme: "default", fileIconWorkspace: true, fileIconResources: true }))
  expect(result.container.querySelector('img')).toBeNull()
})
it("starts collapsed and defaults to only the project resource library", () => {
  function Harness() { const [value, setValue] = useState(defaultSettings); return <FileIconSettings value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} /> }
  const result = render(<Harness />)
  expect(result.queryByRole('switch')).toBeNull()
  fireEvent.click(result.getByRole('button', { name: /文件图标/ }))
  expect(result.getByRole('switch', { name: '项目资源库' }).getAttribute('aria-checked')).toBe('true')
  expect(result.getByRole('switch', { name: '工作区' }).getAttribute('aria-checked')).toBe('false')
  fireEvent.click(result.getByRole('switch', { name: '工作区' }))
  expect(result.getByRole('switch', { name: '工作区' }).getAttribute('aria-checked')).toBe('true')
  fireEvent.click(result.getByRole('switch', { name: '项目资源库' }))
  expect(result.getByRole('switch', { name: '项目资源库' }).getAttribute('aria-checked')).toBe('false')
})
