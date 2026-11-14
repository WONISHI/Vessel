import React from "react"
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PasswordVault } from "@/pages/browser/components/password-vault"

afterEach(cleanup)
it("opens from the browser menu and only displays a password after system authentication", async () => {
  let approve!: (value: { password: string }) => void
  const authentication = new Promise<{ password: string }>((resolve) => { approve = resolve })
  const request = vi.fn(async (action: string) => {
    if (action === "status") return { initialized: true, unlocked: true }
    if (action === "catalog") return { items: [{ id: "entry", origin: "https://example.com", username: "alice", updated: 1 }], requiresUnlock: false }
    if (action === "reveal") return authentication
  })
  window.electronAPI = { vaultRequest: request, onVaultCandidate: () => () => {} } as any
  const result = render(<PasswordVault />)
  act(() => { window.dispatchEvent(new Event("vessel-open-password-vault")) })
  await waitFor(() => expect(result.getByText("alice")).toBeTruthy())
  expect(result.queryByText("site-secret")).toBeNull()
  fireEvent.click(result.getByRole("button", { name: "查看密码" }))
  expect(request).toHaveBeenCalledWith("reveal", { id: "entry" })
  expect(result.queryByText("site-secret")).toBeNull()
  // The system prompt takes focus; returning from it must still show the approved secret.
  act(() => { window.dispatchEvent(new Event("blur")) })
  await act(async () => { approve({ password: "site-secret" }); await authentication })
  await waitFor(() => expect(result.getByText("site-secret")).toBeTruthy())
  act(() => { window.dispatchEvent(new Event("blur")) })
  expect(result.queryByText("site-secret")).toBeNull()
  vi.useFakeTimers()
  try {
    await act(async () => { fireEvent.click(result.getByRole("button", { name: "查看密码" })) })
    expect(result.getByText("site-secret")).toBeTruthy()
    await act(async () => { await vi.advanceTimersByTimeAsync(15000) })
    expect(result.queryByText("site-secret")).toBeNull()
  } finally { vi.useRealTimers() }
})

it("shows an empty all-sites list instead of vault setup when no credentials exist", async () => {
  window.electronAPI = { vaultRequest: vi.fn(async (action) => action === "status" ? { initialized: false, unlocked: false } : { items: [], requiresUnlock: false }), onVaultCandidate: () => () => {} } as any
  const result = render(<PasswordVault />)
  act(() => { window.dispatchEvent(new Event("vessel-open-password-vault")) })
  await waitFor(() => expect(result.getByText("尚未保存账号和密码")).toBeTruthy())
  expect(result.queryByRole("button", { name: "创建保险库" })).toBeNull()
  expect(result.queryByPlaceholderText("主密码（至少 12 个字符）")).toBeNull()
})
it("lists and searches every saved site while locked without returning passwords", async () => {
  const items = [{ id: "a", origin: "https://example.com", username: "alice", updated: 1 }, { id: "b", origin: "https://other.test", username: "bob", updated: 2 }]
  let unlocked = false
  const request = vi.fn(async (action) => {
    if (action === "status") return { initialized: true, unlocked }
    if (action === "unlock") { unlocked = true; return }
    if (action === "reveal") return { password: "other-site-secret" }
    return { items, requiresUnlock: false }
  })
  window.electronAPI = { vaultRequest: request, onVaultCandidate: () => () => {} } as any
  const result = render(<PasswordVault url="https://example.com/current-page" />)
  act(() => { window.dispatchEvent(new Event("vessel-open-password-vault")) })
  await waitFor(() => expect(result.getByText("bob")).toBeTruthy())
  expect(result.getByText("alice")).toBeTruthy()
  expect(document.querySelector('img[src="https://other.test/favicon.ico"]')).toBeTruthy()
  expect(result.getAllByLabelText("已保存密码").every((node) => node.textContent === "••••••••")).toBe(true)
  fireEvent.change(result.getByLabelText("搜索保存的账号"), { target: { value: "other.test" } })
  expect(result.queryByText("alice")).toBeNull()
  fireEvent.click(result.getByRole("button", { name: "查看密码" }))
  expect(result.getByPlaceholderText("输入保险库主密码")).toBeTruthy()
  expect(request).not.toHaveBeenCalledWith("reveal", expect.anything())
  fireEvent.change(result.getByPlaceholderText("输入保险库主密码"), { target: { value: "long master password" } })
  fireEvent.submit(result.getByPlaceholderText("输入保险库主密码").closest("form")!)
  await waitFor(() => expect(result.getByText("other-site-secret")).toBeTruthy())
  expect(request).toHaveBeenCalledWith("reveal", { id: "b" })
})

it("only shows the site key for matching saved origins and authenticates the selected account before showing details", async () => {
  let approve!: (value: { password: string }) => void
  const authorization = new Promise<{ password: string }>((resolve) => { approve = resolve })
  const items = [{ id: "first", origin: "https://example.com", username: "first-user", updated: 1 }, { id: "second", origin: "https://example.com", username: "second-user", updated: 2 }, { id: "other", origin: "https://other.test", username: "other-user", updated: 3 }]
  const request = vi.fn(async (action: string) => {
    if (action === "status") return { initialized: true, unlocked: true }
    if (action === "catalog") return { items, requiresUnlock: false }
    if (action === "reveal") return authorization
  })
  window.electronAPI = { vaultRequest: request, onVaultCandidate: () => () => {} } as any
  const result = render(<PasswordVault url="https://example.com/login" />)
  await waitFor(() => expect(result.getByRole("button", { name: "此网站已保存的密码" })).toBeTruthy())
  fireEvent.click(result.getByRole("button", { name: "此网站已保存的密码" }))
  expect(result.getByRole("button", { name: "查看账号 first-user" })).toBeTruthy()
  expect(result.queryByText("other-user")).toBeNull()
  fireEvent.click(result.getByRole("button", { name: "查看账号 second-user" }))
  expect(request).toHaveBeenCalledWith("reveal", { id: "second" })
  expect(result.queryByLabelText("本站账号密码")).toBeNull()
  await act(async () => { approve({ password: "second-secret" }); await authorization })
  await waitFor(() => expect(result.getByLabelText("本站账号密码").textContent).toBe("second-secret"))
  expect(result.getByRole("button", { name: "复制账号" })).toBeTruthy()
  fireEvent.click(result.getByRole("button", { name: "管理密码" }))
  await waitFor(() => expect(result.getByRole("heading", { name: "账号和密码" })).toBeTruthy())
  expect(result.getByRole("heading", { name: "账号和密码" }).closest('[role="dialog"]')?.className).toContain("slide-in-from-right")
  expect(result.getByText("other-user")).toBeTruthy()
  expect(result.queryByText("second-secret")).toBeNull()
  result.rerender(<PasswordVault url="https://not-saved.test/" />)
  expect(result.queryByRole("button", { name: "此网站已保存的密码" })).toBeNull()
})
