import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { CommitMessageInput } from "@/pages/git/components/commit-message-input"
beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("keeps typing local and submits the latest draft, including Chinese text", () => {
  const draft = { current: "" }
  const submit = vi.fn(() => draft.current)
  const parentRender = vi.fn()
  const Parent = () => {
    parentRender()
    return <CommitMessageInput draft={draft} resetVersion={0} onSubmit={submit} />
  }
  render(<Parent />)
  const input = screen.getByRole("textbox")
  for (const value of ["修", "修复", "修复输入卡顿"]) fireEvent.change(input, { target: { value } })
  expect(draft.current).toBe("修复输入卡顿")
  expect(parentRender).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true, isComposing: true })
  expect(submit).not.toHaveBeenCalled()
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true })
  expect(submit).toHaveReturnedWith("修复输入卡顿")
})
it("clears on successful reset and restores a draft after remount", () => {
  const draft = { current: "unfinished" }
  const { rerender, unmount } = render(<CommitMessageInput draft={draft} resetVersion={0} onSubmit={() => {}} />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "updated" } })
  rerender(<CommitMessageInput draft={draft} resetVersion={0} onSubmit={() => {}} />)
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("updated")
  unmount()
  const view = render(<CommitMessageInput draft={draft} resetVersion={0} onSubmit={() => {}} />)
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("updated")
  draft.current = ""
  view.rerender(<CommitMessageInput draft={draft} resetVersion={1} onSubmit={() => {}} />)
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("")
})

it("uses a Radix ScrollArea and grows the editor instead of using a native textarea scrollbar", () => {
  const view = render(<CommitMessageInput draft={{current:"first"}} resetVersion={0} onSubmit={vi.fn()} />)
  const input = screen.getByRole("textbox") as HTMLTextAreaElement
  const viewport = view.container.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]")!
  expect(viewport).toBeTruthy()
  Object.defineProperty(viewport, "clientHeight", {value:80})
  Object.defineProperty(input, "scrollHeight", {get:()=>input.value.length > 20 ? 260 : 80})
  fireEvent.change(input, {target:{value:"long line\n".repeat(20)}})
  expect(input.style.height).toBe("260px")
  expect(input.classList.contains("overflow-hidden")).toBe(true)
  fireEvent.change(input, {target:{value:"short"}})
  expect(input.style.height).toBe("80px")
})

it("switches drafts between repositories without losing either input", () => {
  const first = {current:"first repo"}, second = {current:"second repo"}
  const view = render(<CommitMessageInput draft={first} resetVersion={0} onSubmit={vi.fn()} />)
  fireEvent.change(screen.getByRole("textbox"), {target:{value:"edited first"}})
  view.rerender(<CommitMessageInput draft={second} resetVersion={0} onSubmit={vi.fn()} />)
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("second repo")
  view.rerender(<CommitMessageInput draft={first} resetVersion={0} onSubmit={vi.fn()} />)
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("edited first")
})
