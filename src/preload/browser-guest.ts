import { bindWebStoreInstall } from "./webstore-install"
import { contextBridge, ipcRenderer } from "electron"
import { installExtensionApiShim } from "../main/browser/extensions/extension-api-shim"

// Extension pages (e.g. iGuge login.html) need Chrome APIs Electron lacks before their own scripts run.
if (location.protocol === "chrome-extension:") contextBridge.executeInMainWorld({ func: installExtensionApiShim })
// Narrow page-world bridge: reports state, never input values or page contents.
contextBridge.exposeInMainWorld("vesselPageBridge", {
  /** Performs the report operation. */
  report: (kind: string, value: unknown) => {
    if (["focus", "search-handled", "find"].includes(kind) && typeof value === "boolean") ipcRenderer.sendToHost(`vessel-${kind}`, value)
    if (kind === "favicon" && typeof value === "string" && value.length < 65536 && /^(https?:\/\/|data:image\/)/i.test(value)) ipcRenderer.sendToHost("vessel-favicon", value)
    if (kind === "navigation" && typeof value === "string" && value.length < 16384) ipcRenderer.sendToHost("vessel-navigation", value)
  },

  /** Performs the navigate operation. */
  navigate: (url: string) => typeof url === "string" && url.length < 16384 && ipcRenderer.sendSync("vessel:navigation-choice", url) === true
})

// Mark link activation before its default navigation or SPA handler runs.

/** Performs the link activation operation. */
const linkActivation = (event: MouseEvent) => {
  if (!event.isTrusted) return
  const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("href")) as HTMLAnchorElement | undefined
  if (link) ipcRenderer.sendSync("vessel:anchor-navigation", link.href)
}
window.addEventListener("click", linkActivation, true)
window.addEventListener("auxclick", linkActivation, true)

if (location.protocol === "https:" && location.hostname === "chromewebstore.google.com") bindWebStoreInstall(() => ipcRenderer.send("vessel:webstore-install"))


// Resume the original form submission so POST bodies and submitter values survive the choice.
let formToken = 0
let pendingForm: { token: number; form: HTMLFormElement; submitter: HTMLElement | null } | undefined
let resumingForm = false
ipcRenderer.on("vessel:resume-form", (_event, token: number) => {
  const pending = pendingForm
  if (!pending || pending.token !== token) return
  pendingForm = undefined
  if (!pending.form.isConnected) return
  resumingForm = true
  try {
    HTMLFormElement.prototype.requestSubmit.call(pending.form, pending.submitter ?? undefined)
  } finally {
    resumingForm = false
  }
})
window.addEventListener("submit", (event: SubmitEvent) => {
  if (resumingForm || event.defaultPrevented || !(event.target instanceof HTMLFormElement)) return
  const form = event.target
  const submitter = event.submitter
  const target = submitter?.getAttribute("formtarget") ?? form.target
  if (target && target !== "_self") return
  const url = new URL(submitter?.getAttribute("formaction") || form.action, location.href).href
  const token = ++formToken
  pendingForm = { token, form, submitter }
  if (ipcRenderer.sendSync("vessel:form-navigation-choice", url, token) !== true) event.preventDefault()
  else pendingForm = undefined
})
