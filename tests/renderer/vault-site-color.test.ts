// @vitest-environment-options {"url":"https://example.test/login"}
import { expect, it, vi } from "vitest"
const mock = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => void>() }))
vi.mock("electron", () => ({ ipcRenderer: {
  on: (name: string, fn: any) => mock.handlers.set(name, fn), send: vi.fn(),
  invoke: vi.fn().mockResolvedValue([{ id: "one", username: "admin" }])
} }))
import { bindVaultForms } from "../../src/preload/vault-forms"

it("uses green initially, updates an open suggestion popup and rejects invalid CSS colors", async () => {
  document.body.innerHTML = '<form><input autocomplete="username"><input type="password"></form>'
  for (const input of document.querySelectorAll("input")) vi.spyOn(input, "getClientRects").mockReturnValue([{}] as any)
  const attach = Element.prototype.attachShadow
  let shadow!: ShadowRoot
  vi.spyOn(Element.prototype, "attachShadow").mockImplementation(function (this: Element, init) {
    shadow = attach.call(this, init); return shadow
  })
  bindVaultForms()
  document.querySelector("input")!.focus()
  await vi.waitFor(() => expect(shadow?.querySelector("button")).toBeTruthy())
  const host = shadow.host as HTMLElement
  expect(host.style.getPropertyValue("--vessel-site-color")).toBe("#16a34a")
  expect(shadow.querySelector("style")!.textContent).toContain("background:var(--vessel-site-color,#16a34a)")
  const color = mock.handlers.get("vessel:site-color")!
  color({}, "#4792f1")
  expect(host.style.getPropertyValue("--vessel-site-color")).toBe("#4792f1")
  color({}, "red;display:none")
  expect(host.style.getPropertyValue("--vessel-site-color")).toBe("#4792f1")
  document.body.innerHTML = ""
  host.remove()
})
