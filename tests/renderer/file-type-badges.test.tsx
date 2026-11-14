import React, { useState } from "react"
import { act, cleanup, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import FileTreeItem from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/file-tree-item"
import { FileIconScope, setFileIconSettings } from "@/features/file-icons/state"
import { FileTypeBadgeSettings } from "@/pages/settings/components/file-type-badge-settings"
import { defaultSettings } from "@vessel/utils"
beforeEach(() => setFileIconSettings({}))
afterEach(cleanup)
it("hides file type badges by default and independently controls each scope", () => {
  const node = { name: "readme.md", path: "/project/readme.md", type: "file" as const }
  const row = <FileTreeItem node={node} selected={false} expanded={false} onActivate={vi.fn()} />
  const result = render(<><div data-testid="resources"><FileIconScope.Provider value="resources">{row}</FileIconScope.Provider></div><div data-testid="workspace"><FileIconScope.Provider value="workspace">{row}</FileIconScope.Provider></div></>)
  const badge = (scope: string) => result.getByTestId(scope).querySelector('[data-tree-badge="md"]')
  expect(badge("resources")).toBeNull()
  expect(badge("workspace")).toBeNull()
  act(() => setFileIconSettings({ fileTypeBadgesEnabled: true }))
  expect(badge("resources")).toBeTruthy()
  expect(badge("workspace")).toBeNull()
  act(() => setFileIconSettings({ fileTypeBadgesEnabled: true, fileTypeBadgesResources: false, fileTypeBadgesWorkspace: true }))
  expect(badge("resources")).toBeNull()
  expect(badge("workspace")).toBeTruthy()
  act(() => setFileIconSettings({ fileTypeBadgesEnabled: false, fileTypeBadgesResources: true, fileTypeBadgesWorkspace: true }))
  expect(badge("resources")).toBeNull()
  expect(badge("workspace")).toBeNull()
})
it("provides collapsed shadcn switches with off/resources-only defaults", () => {
  function Harness() { const [value, setValue] = useState(defaultSettings); return <FileTypeBadgeSettings value={value} onChange={(patch) => setValue((current) => ({ ...current, ...patch }))} /> }
  const result = render(<Harness />)
  expect(result.queryByRole("switch")).toBeNull()
  fireEvent.click(result.getByRole("button", { name: /^文件类型徽标/ }))
  expect(result.getByRole("switch", { name: "显示文件类型徽标" }).getAttribute("aria-checked")).toBe("false")
  expect(result.getByRole("switch", { name: "文件类型徽标作用于项目资源库" }).getAttribute("aria-checked")).toBe("true")
  expect(result.getByRole("switch", { name: "文件类型徽标作用于工作区" }).getAttribute("aria-checked")).toBe("false")
  fireEvent.click(result.getByRole("switch", { name: "显示文件类型徽标" }))
  expect(result.getByRole("switch", { name: "显示文件类型徽标" }).getAttribute("aria-checked")).toBe("true")
})
