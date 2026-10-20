import { fireEvent } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { installDataTitleTooltips } from "@/components/ui/data-title-tooltip"
let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); document.body.innerHTML = ""; vi.useRealTimers() })
it("shows dynamically mounted titles as text and dismisses on Escape", () => {
  vi.useFakeTimers()
  dispose = installDataTitleTooltips()
  const button = document.createElement("button")
  button.dataset.title = '<img src=x>安全提示'
  document.body.append(button)
  fireEvent.pointerOver(button)
  vi.advanceTimersByTime(350)
  const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
  expect(tooltip.hidden).toBe(false)
  expect(tooltip.textContent).toBe('<img src=x>安全提示')
  expect(tooltip.querySelector("img")).toBeNull()
  expect(button.getAttribute("aria-describedby")).toBe(tooltip.id)
  fireEvent.keyDown(document, { key: "Escape" })
  expect(tooltip.hidden).toBe(true)
  expect(button.hasAttribute("aria-describedby")).toBe(false)
})
it("supports keyboard focus and preserves existing accessibility descriptions", () => {
  vi.useFakeTimers()
  dispose = installDataTitleTooltips()
  const button = document.createElement("button")
  button.dataset.title = "按钮说明"
  button.setAttribute("aria-describedby", "existing")
  document.body.append(button)
  fireEvent.focusIn(button)
  vi.advanceTimersByTime(100)
  expect(button.getAttribute("aria-describedby")).toContain("existing vessel-data-title-")
  fireEvent.scroll(document)
  expect(button.getAttribute("aria-describedby")).toBe("existing")
  expect(document.querySelector<HTMLElement>('[role="tooltip"]')!.hidden).toBe(true)
})
it("cancels a pending tooltip on pointer down and cleans up the global layer", () => {
  vi.useFakeTimers()
  dispose = installDataTitleTooltips()
  const button = document.createElement("button")
  button.dataset.title = "提示"
  document.body.append(button)
  fireEvent.pointerOver(button)
  fireEvent.pointerDown(button)
  vi.advanceTimersByTime(400)
  expect(document.querySelector<HTMLElement>('[role="tooltip"]')!.hidden).toBe(true)
  dispose()
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
})
it("positions workspace tab tooltips below the tab instead of to the side", () => {
  vi.useFakeTimers()
  dispose = installDataTitleTooltips()
  const tab = document.createElement("div")
  tab.dataset.workspaceTab = "true"
  const button = document.createElement("button")
  button.dataset.title = "/vault/note.md"
  tab.append(button)
  document.body.append(tab)
  fireEvent.pointerOver(button)
  vi.advanceTimersByTime(350)
  const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
  expect(tooltip.hidden).toBe(false)
  expect(tooltip.dataset.side).toBe("bottom")
})
it("positions status bar tooltips above the target", () => {
  vi.useFakeTimers()
  dispose = installDataTitleTooltips()
  const statusBar = document.createElement("footer")
  statusBar.className = "vessel-status-bar"
  const stats = document.createElement("footer")
  stats.dataset.title = "统计 Markdown 正文"
  stats.dataset.titleSide = "top"
  statusBar.append(stats)
  document.body.append(statusBar)
  fireEvent.pointerOver(stats)
  vi.advanceTimersByTime(350)
  const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!
  expect(tooltip.hidden).toBe(false)
  expect(tooltip.dataset.side).toBe("top")
})

