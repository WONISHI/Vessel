import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { CommitMessageInput } from "@/pages/git/components/commit-message-input"
afterEach(cleanup)
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
