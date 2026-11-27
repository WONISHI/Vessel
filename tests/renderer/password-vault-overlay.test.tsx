import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PasswordVault } from "@/pages/browser/components/password-vault"
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('requires explicit consent before importing local credentials into the remote vault', async () => {
  const request = vi.fn(async (action: string) => action === 'catalog' ? { items: [], requiresUnlock: false } : { initialized: true, unlocked: true, auto: true, source: 'remote' })
  vi.stubGlobal('electronAPI', { vaultRequest: request, onVaultCandidate: () => () => {} })
  render(<PasswordVault />)
  act(() => window.dispatchEvent(new Event('vessel-open-password-vault')))
  fireEvent.click(await screen.findByRole('button', { name: '导入本机账号' }))
  expect(screen.getByText('导入本机账号到当前远程保险库？')).toBeTruthy()
  expect(request.mock.calls.some(([action]) => action === 'import-local')).toBe(false)
  fireEvent.click(screen.getByRole('button', { name: '验证并导入' }))
  await waitFor(() => expect(request).toHaveBeenCalledWith('import-local', undefined))
})
it("leaves activity and status navigation interactive when the vault is open", () => {
  vi.stubGlobal("electronAPI", { onVaultCandidate: () => () => {}, vaultRequest: vi.fn(async (action: string) => action === "catalog" ? { items: [], requiresUnlock: false } : { initialized: false, unlocked: true, auto: true }) })
  const navigate = vi.fn()
  render(<><button onClick={navigate}>活动栏</button><PasswordVault /></>)
  act(() => window.dispatchEvent(new Event("vessel-open-password-vault")))
  expect(document.querySelector("[data-vault-overlay]")).toBeNull()
  expect(document.body.style.pointerEvents).not.toBe("none")
  const button = screen.getByRole("button", { name: "活动栏" })
  expect(button.closest('[aria-hidden="true"]')).toBeNull()
  fireEvent.click(button)
  expect(navigate).toHaveBeenCalledOnce()
})


it("asks before saving credentials detected on a local development page", async () => {
  let candidate!: (value: { id: string; origin: string; username: string }) => void
  const request = vi.fn(async (action: string) => action === "catalog" ? { items: [], requiresUnlock: false } : { initialized: true, unlocked: true, auto: true })
  vi.stubGlobal("electronAPI", { vaultRequest: request, onVaultCandidate: (callback: typeof candidate) => { candidate = callback; return () => {} } })
  render(<PasswordVault url="http://localhost:9525/login" />)
  act(() => candidate({ id: "local-candidate", origin: "http://localhost:9525", username: "local-test-user" }))
  expect(screen.getByRole("dialog", { name: "保存密码？" })).toBeTruthy()
  expect(screen.getByText("http://localhost:9525 · local-test-user")).toBeTruthy()
  expect(request).not.toHaveBeenCalledWith("candidate", expect.anything())
  fireEvent.click(screen.getByRole("button", { name: "保存 / 更新" }))
  await waitFor(() => expect(request).toHaveBeenCalledWith("candidate", { id: "local-candidate", choice: "save" }))
})

it("lists Git credentials with a Git badge while excluding them from website autofill", async () => {
  const items = [{ id: "git-entry", origin: "https://git.test", username: "developer", kind: "git", gitPath: "team/project.git", updated: 1 }]
  vi.stubGlobal("electronAPI", { onVaultCandidate: () => () => {}, vaultRequest: vi.fn(async (action: string) => action === "catalog" ? { items, requiresUnlock: false } : { initialized: true, unlocked: true, auto: true }) })
  render(<PasswordVault url="https://git.test/login" />)
  act(() => window.dispatchEvent(new Event("vessel-open-password-vault")))
  fireEvent.click(await screen.findByRole("button", { name: "展开 git.test 账号分组" }))
  expect(screen.getByText("Git")).toBeTruthy()
  expect(screen.getByText("developer")).toBeTruthy()
  expect(screen.getByText("team/project.git")).toBeTruthy()
  expect(screen.queryByRole("button", { name: "此网站已保存的密码" })).toBeNull()
  expect(screen.getByLabelText("已保存密码").textContent).toBe("••••••••")
})

it("keeps the manager open when menu focus returns outside, while allowing explicit close", async () => {
  vi.stubGlobal("electronAPI", { onVaultCandidate: () => () => {}, vaultRequest: vi.fn(async (action: string) => action === "catalog" ? { items: [], requiresUnlock: false } : { initialized: false, unlocked: true, auto: true }) })
  render(<><button>更多菜单触发器</button><PasswordVault /></>)
  act(() => window.dispatchEvent(new Event("vessel-open-password-vault")))
  expect(await screen.findByRole("heading", { name: "账号和密码" })).toBeTruthy()
  act(() => screen.getByRole("button", { name: "更多菜单触发器" }).focus())
  await waitFor(() => expect(screen.getByRole("dialog").getAttribute("data-state")).toBe("open"))
  fireEvent.click(screen.getByRole("button", { name: "关闭面板" }))
  expect(screen.queryByRole("dialog")).toBeNull()
})
