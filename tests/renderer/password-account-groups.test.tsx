import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PasswordAccounts } from "@/pages/browser/components/password-accounts"

afterEach(cleanup)
it("groups same-domain accounts, retains individual actions, and searches within groups", () => {
  const reveal = vi.fn(), remove = vi.fn()
  render(<PasswordAccounts items={[
    { id: "first", origin: "https://github.com", username: "first-user", updated: 1 },
    { id: "second", origin: "https://github.com", username: "second-user", updated: 2 },
    { id: "other", origin: "https://other.test", username: "other-user", updated: 3 }
  ]} revealed={null} busy={false} requiresUnlock={false} onReveal={reveal} onDelete={remove} onSettings={vi.fn()} />)
  const group = screen.getByRole("region", { name: "github.com 账号分组" })
  expect(screen.getAllByText("github.com")).toHaveLength(1)
  expect(within(group).getByText("2 个账号")).toBeTruthy()
  expect(within(group).queryByText("first-user")).toBeNull()
  fireEvent.click(within(group).getByRole("button", { name: "展开 github.com 账号分组" }))
  fireEvent.click(within(group).getAllByRole("button", { name: "查看密码" })[1])
  expect(reveal).toHaveBeenCalledWith("second")
  fireEvent.click(within(group).getAllByRole("button", { name: "删除账号" })[0])
  expect(remove).toHaveBeenCalledWith("first")
  fireEvent.change(screen.getByRole("textbox", { name: "搜索保存的账号" }), { target: { value: "second" } })
  expect(screen.queryByText("first-user")).toBeNull()
  expect(screen.queryByText("other.test")).toBeNull()
  expect(screen.getByText("second-user")).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "收起 github.com 账号分组" }))
  expect(screen.queryByText("second-user")).toBeNull()
  fireEvent.change(screen.getByRole("textbox", { name: "搜索保存的账号" }), { target: { value: "other" } })
  expect(screen.getByText("other-user")).toBeTruthy()
})
it("shows origin and Git metadata separately when a domain has different credential contexts", () => {
  render(<PasswordAccounts items={[
    { id: "web", origin: "http://localhost:9523", username: "web-user", updated: 1 },
    { id: "git", origin: "http://localhost:8090", username: "git-user", kind: "git", gitPath: "team/repo.git", updated: 1 }
  ]} revealed={{ id: "git", password: "fixture-token" }} busy={false} requiresUnlock={false} onReveal={vi.fn()} onDelete={vi.fn()} onSettings={vi.fn()} />)
  expect(screen.getAllByRole("region")).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "展开 localhost 账号分组" }))
  expect(screen.getByText("http://localhost:9523")).toBeTruthy()
  expect(screen.getByText("http://localhost:8090")).toBeTruthy()
  expect(screen.getByText("Git")).toBeTruthy()
  expect(screen.getAllByLabelText("已保存密码").map(node => node.textContent)).toEqual(["••••••••", "fixture-token"])
})
