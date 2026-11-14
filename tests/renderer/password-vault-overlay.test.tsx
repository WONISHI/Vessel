import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { PasswordVault } from "@/pages/browser/components/password-vault"
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("leaves activity and status navigation interactive when the vault is open", () => {
  vi.stubGlobal("electronAPI", { onVaultCandidate: () => () => {}, vaultRequest: vi.fn().mockResolvedValue({ initialized: false, unlocked: false }) })
  const navigate = vi.fn()
  render(<><button onClick={navigate}>活动栏</button><PasswordVault /></>)
  fireEvent.click(screen.getByRole("button", { name: "密码保险库" }))
  const overlay = document.querySelector("[data-vault-overlay]")!
  expect(overlay.classList.contains("left-[52px]")).toBe(true)
  expect(overlay.classList.contains("bottom-8")).toBe(true)
  expect(document.body.style.pointerEvents).not.toBe("none")
  const button = screen.getByRole("button", { name: "活动栏" })
  expect(button.closest('[aria-hidden="true"]')).toBeNull()
  fireEvent.click(button)
  expect(navigate).toHaveBeenCalledOnce()
})
