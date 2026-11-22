import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TerminalPanel } from "@/components/workspace/components/layout-main/terminal-panel"

const fitViewport = vi.hoisted(() => vi.fn())

vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    options = {}
    cols = 80
    rows = 24
    loadAddon = vi.fn()
    open = vi.fn()
    focus = vi.fn()
    refresh = vi.fn()
    write = vi.fn()
    dispose = vi.fn()
    onData() { return { dispose: vi.fn() } }
  }
}))
vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = fitViewport } }))

const terminalStart = vi.fn(async (_root: string, directory: string) => ({ id: directory, cwd: directory }))
const terminalClose = vi.fn(async () => {})

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  vi.stubGlobal("electronAPI", undefined)
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      terminalStart,
      terminalClose,
      onTerminalData: () => () => {},
      terminalResize: vi.fn(async () => {})
    }
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("keeps the active shell and sessions across file switches and panel reopening", async () => {
  const root = "/terminal-persistence"
  const view = render(<TerminalPanel root={root} file={`${root}/partials/admin.html`} />)
  await waitFor(() => expect(screen.getByText(`${root}/partials`)).toBeTruthy())
  fireEvent.click(screen.getByRole("button", { name: "新建终端" }))
  await waitFor(() => expect(terminalStart).toHaveBeenCalledTimes(2))
  view.rerender(<TerminalPanel root={root} file={`${root}/pages/preview.html`} />)
  expect(screen.getByRole("tab", { name: "2: zsh" }).getAttribute("aria-selected")).toBe("true")
  expect(screen.getByText(`${root}/partials`)).toBeTruthy()
  expect(terminalStart).toHaveBeenCalledTimes(2)
  expect(terminalClose).not.toHaveBeenCalled()

  view.unmount()
  render(<TerminalPanel root={root} file={`${root}/pages/preview.html`} />)
  expect(screen.getByRole("tab", { name: "2: zsh" }).getAttribute("aria-selected")).toBe("true")
  expect(screen.getByText(`${root}/partials`)).toBeTruthy()
  expect(terminalStart).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole("button", { name: "删除终端" }))
  expect(terminalClose).toHaveBeenCalledTimes(1)
})

it("keeps shells isolated between workspaces", async () => {
  const view = render(<TerminalPanel key="a" root="/terminal-a" />)
  await waitFor(() => expect(screen.getByText("/terminal-a")).toBeTruthy())
  view.rerender(<TerminalPanel key="b" root="/terminal-b" />)
  await waitFor(() => expect(screen.getByText("/terminal-b")).toBeTruthy())
  view.rerender(<TerminalPanel key="a" root="/terminal-a" />)
  expect(screen.getByText("/terminal-a")).toBeTruthy()
  expect(terminalStart).toHaveBeenCalledTimes(2)
  expect(terminalClose).not.toHaveBeenCalled()
})

it("starts each new terminal in the current file folder and shows the selected terminal folder", async () => {
  const root = "/terminal-directories"
  const view = render(<TerminalPanel root={root} file={`${root}/partials/admin.html`} />)
  await waitFor(() => expect(screen.getByText(`${root}/partials`)).toBeTruthy())

  view.rerender(<TerminalPanel root={root} file={`${root}/pages/preview.html`} />)
  expect(screen.getByText(`${root}/partials`)).toBeTruthy()
  expect(terminalStart).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole("button", { name: "新建终端" }))
  await waitFor(() => expect(screen.getByText(`${root}/pages`)).toBeTruthy())
  expect(terminalStart).toHaveBeenLastCalledWith(root, `${root}/pages`, 80, 24)

  fireEvent.click(screen.getByRole("tab", { name: "1: zsh" }))
  expect(screen.getByText(`${root}/partials`)).toBeTruthy()
  fireEvent.click(screen.getByRole("tab", { name: "2: zsh" }))
  expect(screen.getByText(`${root}/pages`)).toBeTruthy()

  view.unmount()
  const reopened = render(<TerminalPanel root={root} />)
  expect(screen.getByText(`${root}/pages`)).toBeTruthy()
  expect(terminalStart).toHaveBeenCalledTimes(2)
  fireEvent.click(screen.getByRole("tab", { name: "1: zsh" }))
  expect(screen.getByText(`${root}/partials`)).toBeTruthy()

  fireEvent.click(screen.getByRole("button", { name: "新建终端" }))
  await waitFor(() => expect(screen.getByText(root)).toBeTruthy())
  expect(terminalStart).toHaveBeenLastCalledWith(root, root, 80, 24)
  expect(terminalClose).not.toHaveBeenCalled()
  reopened.unmount()
})


it("does not fit or repaint the terminal while its panel is closing", async () => {
  let notifyResize: () => void = () => undefined
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { notifyResize = callback }
    observe = vi.fn()
    disconnect = vi.fn()
  })
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1 })
  const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800)
  const height = vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(200)
  try {
    const view = render(<div data-console-motion="idle"><TerminalPanel root="/terminal-closing" /></div>)
    await waitFor(() => expect(screen.getByText("/terminal-closing")).toBeTruthy())
    const baseline = fitViewport.mock.calls.length
    view.container.firstElementChild!.setAttribute("data-console-motion", "exit")
    notifyResize()
    notifyResize()
    expect(fitViewport).toHaveBeenCalledTimes(baseline)
    view.container.firstElementChild!.setAttribute("data-console-motion", "idle")
    notifyResize()
    expect(fitViewport).toHaveBeenCalledTimes(baseline + 1)
  } finally { width.mockRestore(); height.mockRestore() }
})
