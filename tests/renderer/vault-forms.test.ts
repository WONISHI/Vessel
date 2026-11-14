// @vitest-environment-options {"url":"https://example.test/login"}
import { afterEach, expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => void>(), send: vi.fn() }))
vi.mock("electron", () => ({ ipcRenderer: { on: (name: string, fn: any) => mock.handlers.set(name, fn), send: mock.send } }))
import { bindVaultForms } from "../../src/preload/vault-forms"
afterEach(() => { document.body.innerHTML = "" })
it("fills only a visible same-origin login form without submitting", () => {
  bindVaultForms()
  document.body.innerHTML = '<form action="https://example.test/login"><input autocomplete="username"><input type="password" autocomplete="current-password"></form>'
  const [username, password] = [...document.querySelectorAll("input")]
  for (const input of [username, password]) vi.spyOn(input, "getClientRects").mockReturnValue([{}] as any)
  const input = vi.fn(), submit = vi.fn()
  password.addEventListener("input", input); document.querySelector("form")!.addEventListener("submit", submit)
  const fill = mock.handlers.get("vault:fill")!
  fill({}, { origin: "https://attacker.test", username: "user", password: "secret" })
  expect(password.value).toBe("")
  fill({}, { origin: "https://example.test", username: "user", password: "secret" })
  expect(username.value).toBe("user"); expect(password.value).toBe("secret")
  expect(input).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled()
  expect(mock.send).not.toHaveBeenCalled()
  password.value = ""
  document.querySelector("form")!.action = "https://attacker.test/login"
  fill({}, { origin: "https://example.test", username: "user", password: "secret" })
  expect(password.value).toBe("")
  document.querySelector("form")!.action = "https://example.test/login"
  password.autocomplete = "new-password"
  fill({}, { origin: "https://example.test", username: "user", password: "secret" })
  expect(password.value).toBe("")
})
