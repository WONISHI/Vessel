import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
import { TypographySettings } from "@/pages/settings/components/typography-settings"
const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView); else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView") })
it("groups fonts and sizes and adjusts editor size independently of interface size", () => {
  function Settings() {
    const [value, setValue] = useState(defaultSettings)
    return <TypographySettings value={value} onChange={patch => setValue(current => ({ ...current, ...patch }))} />
  }
  render(<Settings />)
  expect(screen.getByRole("combobox", { name: "界面字体" })).toBeTruthy()
  expect(screen.getByRole("combobox", { name: "编辑器字体" })).toBeTruthy()
  const editor = screen.getByRole("slider", { name: "编辑器字体大小" })
  fireEvent.keyDown(editor, { key: "End" })
  expect(editor.getAttribute("aria-valuenow")).toBe("32")
  expect(screen.getByRole("slider", { name: "界面字体大小" }).getAttribute("aria-valuenow")).toBe("14")
})

it.each([["Nord 深色", "vessel-nord"], ["Nord 浅色", "vessel-nord-light"]])("offers %s and updates only the selected editor theme", async (label, theme) => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { value: vi.fn(), configurable: true, writable: true })
  const change = vi.fn()
  render(<TypographySettings value={defaultSettings} onChange={change} />)
  fireEvent.keyDown(screen.getByRole("combobox", { name: "代码编辑器主题" }), { key: "Enter" })
  fireEvent.click(await screen.findByRole("option", { name: label }))
  expect(change).toHaveBeenCalledWith({ editorTheme: theme })
})
