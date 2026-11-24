import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitAuthDialog } from "@/pages/git/components/git-auth-dialog"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("asks for username and masked token and cancels pending authentication on unmount", () => {
  let request: (value: { id: string; host: string; password: boolean }) => void = () => {}
  let dismiss: (id: string) => void = () => {}
  const respondAuth = vi.fn()
  vi.stubGlobal("electronAPI", { git: { onAuthRequest: (callback: typeof request) => { request = callback; return vi.fn() }, onAuthDismiss: (callback: typeof dismiss) => { dismiss = callback; return vi.fn() }, respondAuth } })
  const { unmount } = render(<GitAuthDialog />)
  act(() => request({ id: "username", host: "http://git.test", password: false }))
  fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "user" } })
  fireEvent.click(screen.getByRole("button", { name: "继续" }))
  expect(respondAuth).toHaveBeenLastCalledWith("username", "user")
  act(() => request({ id: "password", host: "http://git.test", password: true }))
  expect((screen.getByLabelText("密码或访问令牌") as HTMLInputElement).type).toBe("password")
  fireEvent.change(screen.getByLabelText("密码或访问令牌"), { target: { value: "token" } })
  act(() => dismiss("password"))
  expect(screen.queryByRole("dialog")).toBeNull()
  act(() => request({ id: "cancel", host: "http://git.test", password: false }))
  unmount()
  expect(respondAuth).toHaveBeenLastCalledWith("cancel", null)
})
