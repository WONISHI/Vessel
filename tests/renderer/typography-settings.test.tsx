import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { defaultSettings } from "@vessel/utils"
import { TypographySettings } from "@/pages/settings/components/typography-settings"
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
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
