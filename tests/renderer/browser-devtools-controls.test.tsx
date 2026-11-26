import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { BrowserDevtoolsControls } from "@/pages/browser/components/browser-page/browser-devtools-controls"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

afterEach(cleanup)
it("keeps docking and typography settings usable in the overflow popover", () => {
  const setDock = vi.fn(), setConsoleFont = vi.fn(), setConsoleSize = vi.fn(), setConsoleLanguage = vi.fn(), setDevtoolsOpen = vi.fn()
  render(<BrowserDevtoolsControls b={{ dock: "right", consoleFont: "Menlo", consoleSize: 13, consoleLanguage: "zh", setDock, setConsoleFont, setConsoleSize, setConsoleLanguage, setDevtoolsOpen } as unknown as BrowserPageModel} />)
  expect(screen.queryByRole("combobox")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "网页控制台更多设置" }))
  const popup = within(screen.getByRole("dialog", { name: "网页控制台设置" }))
  fireEvent.change(popup.getByLabelText("控制台停靠位置"), { target: { value: "bottom" } })
  fireEvent.change(popup.getByLabelText("控制台字体"), { target: { value: "Consolas" } })
  fireEvent.change(popup.getByLabelText("控制台字号（整体缩放）"), { target: { value: "16" } })
  expect(setDock).toHaveBeenCalledExactlyOnceWith("bottom")
  expect(setConsoleFont).toHaveBeenCalledExactlyOnceWith("Consolas")
  expect(setConsoleSize).toHaveBeenCalledExactlyOnceWith(16)
  expect((popup.getByLabelText("控制台界面语言") as HTMLSelectElement).value).toBe("zh")
  fireEvent.change(popup.getByLabelText("控制台界面语言"), { target: { value: "en-US" } })
  expect(setConsoleLanguage).toHaveBeenCalledExactlyOnceWith("en-US")
  fireEvent.click(screen.getByRole("button", { name: "关闭网页控制台" }))
  expect(setDevtoolsOpen).toHaveBeenCalledExactlyOnceWith(false)
})
