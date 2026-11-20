import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PasswordVault } from "@/pages/browser/components/password-vault"
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("leaves activity and status navigation interactive when the vault is open", () => {
  vi.stubGlobal("electronAPI", { onVaultCandidate: () => () => {}, vaultRequest: vi.fn(async (action: string) => action === "catalog" ? { items: [], requiresUnlock: false } : { initialized: false, unlocked: true, auto: true }) })
  const navigate = vi.fn()
  render(<><button onClick={navigate}>活动栏</button><PasswordVault /></>)
  act(() => window.dispatchEvent(new Event("vessel-open-password-vault")))
  const overlay = document.querySelector("[data-vault-overlay]")!
  expect((overlay as HTMLElement).style.left).toBe("52px")
  expect((overlay as HTMLElement).style.bottom).toBe("32px")
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
