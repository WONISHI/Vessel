import { vaultCredentialOrigin } from "../shared/vault-origin"
import { ipcRenderer } from "electron"

/** Only top-level HTTPS or loopback HTTP login forms participate; no page-world credential API is exposed. */
export function bindVaultForms() {
  if (window.top !== window || !vaultCredentialOrigin(location.href)) return
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
  // Chrome-style suggestions: focusing the account or password field lists saved accounts for this origin.
  type Suggestion = { id: string; username: string }
  let menu: HTMLDivElement | undefined, menuInput: HTMLInputElement | undefined, suggestions: Suggestion[] = []
  const loginFields = (input: HTMLInputElement) => {
    const passwords = [...document.querySelectorAll<HTMLInputElement>('input[type="password"]')].filter(visible)
    if (passwords.length !== 1 || passwords[0].autocomplete === "new-password") return false
    const form = passwords[0].form
    const scope: ParentNode = form ?? document
    const inputs = [...scope.querySelectorAll<HTMLInputElement>("input")].filter(visible)
    const username = inputs.find((item) => item.autocomplete === "username") || inputs.find((item) => item.type === "email") || inputs.find((item) => item.type === "text")
    return input === passwords[0] || input === username
  }
  const closeMenu = () => { menu?.remove(); menu = undefined; menuInput = undefined }
  const place = () => {
    if (!menu || !menuInput?.isConnected) return closeMenu()
    const rect = menuInput.getBoundingClientRect()
    Object.assign(menu.style, { left: `${rect.left}px`, top: `${rect.bottom + 2}px`, width: `${Math.max(200, rect.width)}px` })
  }
  const open = async (input: HTMLInputElement) => {
    if (!loginFields(input)) return
    const list = (await ipcRenderer.invoke("vault:suggest").catch(() => [])) as Suggestion[]
    if (!Array.isArray(list) || !list.length || document.activeElement !== input) return
    suggestions = list
    closeMenu()
    menuInput = input
    const host = document.createElement("div")
    host.style.cssText = "position:fixed;z-index:2147483647;"
    const shadow = host.attachShadow({ mode: "closed" })
    const style = document.createElement("style")
    style.textContent = ".box{box-sizing:border-box;padding:4px;background:#fff;color:#1c1917;border:1px solid #e7e5e4;border-radius:10px;box-shadow:0 8px 28px #0000002b;font:13px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;max-height:240px;overflow:auto}.hint{padding:4px 8px 6px;font-size:11px;color:#78716c}button{display:flex;width:100%;align-items:center;gap:8px;padding:7px 8px;border:0;border-radius:6px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}button:hover,button:focus-visible{background:#16a34a;color:#fff;outline:none}svg{flex:none;width:14px;height:14px}@media (prefers-color-scheme:dark){.box{background:#23272d;color:#f1f5f9;border-color:#363c44}.hint{color:#9ca3af}}"
    const box = document.createElement("div")
    box.className = "box"
    const hint = document.createElement("div")
    hint.className = "hint"
    hint.textContent = "选择已保存的账号"
    box.append(hint)
    const typed = input.type === "password" ? "" : input.value.trim().toLowerCase()
    for (const item of suggestions.filter((entry) => !typed || entry.username.toLowerCase().includes(typed))) {
      const button = document.createElement("button")
      button.type = "button"
      button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 8.4-8.4M18 5l3 3M15 8l2 2"/></svg>'
      const label = document.createElement("span")
      label.textContent = item.username || "未提供账号"
      button.append(label)
      // Keep focus in the page field and require a real click so pages cannot trigger a fill.
      button.addEventListener("mousedown", (event) => event.preventDefault())
      button.addEventListener("click", (event) => {
        if (!event.isTrusted) return
        ipcRenderer.send("vault:use", item.id)
        closeMenu()
      })
      box.append(button)
    }
    if (box.childElementCount === 1) return
    shadow.append(style, box)
    document.documentElement.append(host)
    menu = host
    place()
  }
  window.addEventListener("focusin", (event) => {
    if (event.isTrusted && event.target instanceof HTMLInputElement) void open(event.target)
  }, true)
  window.addEventListener("input", (event) => {
    if (event.isTrusted && menuInput && event.target === menuInput) { void open(menuInput) }
  }, true)
  window.addEventListener("focusout", () => setTimeout(() => { if (document.activeElement !== menuInput) closeMenu() }, 150), true)
  window.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu() }, true)
  window.addEventListener("scroll", closeMenu, true)
  window.addEventListener("resize", closeMenu)
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
