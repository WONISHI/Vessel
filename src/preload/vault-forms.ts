import { ipcRenderer } from "electron"

/** Only top-level HTTPS login forms participate; no page-world credential API is exposed. */
export function bindVaultForms() {
  if (window.top !== window || location.protocol !== "https:") return
  const visible = (input: HTMLInputElement) => !input.disabled && input.getClientRects().length > 0 && getComputedStyle(input).visibility !== "hidden"
  const reported = new WeakMap<HTMLFormElement, string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const capture = (form: HTMLFormElement) => {
    if (!form.isConnected || new URL(form.action || location.href, location.href).origin !== location.origin) return
    const passwords = [...form.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter(visible)
    if (passwords.length !== 1 || passwords[0].autocomplete === "new-password") return
    const inputs = [...form.querySelectorAll<HTMLInputElement>("input")].filter(visible)
    const username = inputs.find((input) => input.autocomplete === "username") || inputs.find((input) => input.type === "email") || inputs.find((input) => input.type === "text")
    const password = passwords[0]
    if (!username?.value || !password.value) return
    const identity = JSON.stringify([username.value, password.value])
    if (reported.get(form) === identity) return
    reported.set(form, identity)
    setTimeout(() => reported.delete(form), 60000)
    ipcRenderer.send("vault:submit", { username: username.value, password: password.value })
  }
  window.addEventListener("submit", (event) => {
    if (event.isTrusted && event.target instanceof HTMLFormElement) { clearTimeout(timer); capture(event.target) }
  }, true)
  window.addEventListener("focusout", (event) => {
    const field = event.target
    if (!event.isTrusted || !(field instanceof HTMLInputElement) || !field.form) return
    if (!["text", "email", "password"].includes(field.type)) return
    const form = field.form
    clearTimeout(timer)
    timer = setTimeout(() => {
      // Wait until the user leaves the credential fields; never interrupt typing.
      const focused = document.activeElement
      if (focused instanceof HTMLInputElement && focused.form === form && ["text", "email", "password"].includes(focused.type)) return
      capture(form)
    }, 500)
  }, true)
  ipcRenderer.on("vault:fill", (_event, data: { origin: string; username: string; password: string }) => {
    if (location.origin !== data.origin) return
    const passwords = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter(visible)
    if (passwords.length !== 1 || passwords[0].autocomplete === "new-password") return
    const password = passwords[0], form = password.form
    if (!form || new URL(form.action || location.href, location.href).origin !== location.origin) return
    const inputs = [...form.querySelectorAll<HTMLInputElement>('input')].filter(visible)
    const username = inputs.find((input) => input.autocomplete === "username") || inputs.find((input) => input.type === "email") || inputs.find((input) => input.type === "text")
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    for (const [input, value] of [[username, data.username], [password, data.password]] as const) {
      if (!input) continue
      setter.call(input, value)
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }))
    }
  })
}
