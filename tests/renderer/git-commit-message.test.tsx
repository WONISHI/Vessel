import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { GitCommitFiles } from "@/pages/git/components/git-commit-files"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { CommitMessageInput } from "@/pages/git/components/commit-message-input"

beforeEach(() => { vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn(); unobserve = vi.fn() }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

it("scrolls commit drafts through ScrollArea while preserving typing, reset, and submit shortcuts", () => {
  const draft = { current: "feat: 第一行\n\n说明" }
  const submit = vi.fn()
  const view = render(<CommitMessageInput draft={draft} resetVersion={0} onSubmit={submit} />)
  const input = screen.getByRole("textbox", { name: "提交信息" }) as HTMLTextAreaElement
  expect(input.closest('[data-radix-scroll-area-viewport]')).toBeTruthy()
  expect(input.closest('[data-vessel-scroll="area"]')).toBeTruthy()
  Object.defineProperty(input, "scrollHeight", { configurable: true, value: 420 })
  fireEvent.change(input, { target: { value: "feat: 更新\n\n多行说明\n结束" } })
  expect(input.style.height).toBe("420px")
  expect(draft.current).toBe(input.value)
  fireEvent.keyDown(input, { key: "Enter", ctrlKey: true })
  expect(submit).toHaveBeenCalledOnce()
  draft.current = ""
  view.rerender(<CommitMessageInput draft={draft} resetVersion={1} onSubmit={submit} />)
  expect((screen.getByRole("textbox", { name: "提交信息" }) as HTMLTextAreaElement).value).toBe("")
})

it("preserves commit paragraphs when expanding/collapsing and resets on commit selection", () => {
  const message = "refactor(certificate): 重构证书数据导入页面及相关组件\n\n- 删除旧组件\n- 新增导入主页面\n\n保留说明段落。"
  const g = { repoPath: "/repo", commitDetail: { hash: "first", message, author: "Test", email: "test@example.com", date: "2026/11/18", files: [] } } as unknown as GitPageModel
  const view = render(<GitCommitFiles g={g} />)
  expect(screen.getByLabelText("提交标题").textContent).toBe(message.split("\n")[0])
  expect(screen.getByLabelText("提交说明").textContent).toBe("- 删除旧组件\n- 新增导入主页面\n\n保留说明段落。")
  const expand = screen.getByRole("button", { name: "展开说明" })
  expect(expand.getAttribute("aria-expanded")).toBe("false")
  fireEvent.click(expand)
  expect(screen.getByRole("button", { name: "收起说明" }).getAttribute("aria-expanded")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "收起说明" }))
  expect(screen.getByRole("button", { name: "展开说明" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "展开说明" }))
  view.rerender(<GitCommitFiles g={{ ...g, commitDetail: { ...g.commitDetail!, hash: "second", message: "fix: 简短提交" } }} />)
  expect(screen.queryByRole("button", { name: /说明$/ })).toBeNull()
  expect(screen.getByLabelText("提交标题").textContent).toBe("fix: 简短提交")
  view.rerender(<GitCommitFiles g={g} />)
  expect(screen.getByRole("button", { name: "展开说明" }).getAttribute("aria-expanded")).toBe("false")
})
