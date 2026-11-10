import { bindDoubleSpace } from "../shared/double-space"
import { scrollBoundary } from "../shared/scroll-boundary"
import { bindWebStoreInstall } from "./webstore-install"
import { contextBridge, ipcRenderer } from "electron"
import { installExtensionApiShim } from "../main/browser/extensions/extension-api-shim"

// Extension pages (e.g. iGuge login.html) need Chrome APIs Electron lacks before their own scripts run.
if (location.protocol === "chrome-extension:") contextBridge.executeInMainWorld({ func: installExtensionApiShim })
/** Makes navigator.userAgentData agree with the Sec-CH-UA request headers rewritten in browser-identity.ts; mismatches trip bot detection (e.g. GitHub "访问暂时受限"). */
function alignClientHints(major: string, full: string) {
  const data = (navigator as Navigator & { userAgentData?: object }).userAgentData as (object & { getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>> }) | undefined
  if (!data) return
  const brands = [{ brand: "Chromium", version: major }, { brand: "Google Chrome", version: major }, { brand: "Not_A Brand", version: "99" }]
  const fullVersionList = [{ brand: "Chromium", version: full }, { brand: "Google Chrome", version: full }, { brand: "Not_A Brand", version: "99.0.0.0" }]
  const proto = Object.getPrototypeOf(data)
  Object.defineProperty(proto, "brands", { configurable: true, enumerable: true, get: () => brands.map((item) => ({ ...item })) })
  const original = proto.getHighEntropyValues
  if (typeof original === "function")
    proto.getHighEntropyValues = function (hints: string[]) {
      return original.call(this, hints).then((value: Record<string, unknown>) => ({ ...value, brands, ...(hints.includes("fullVersionList") ? { fullVersionList } : {}), ...(hints.includes("uaFullVersion") ? { uaFullVersion: full } : {}) }))
    }
}
if (/^https?:$/.test(location.protocol)) contextBridge.executeInMainWorld({ func: alignClientHints, args: [process.versions.chrome.split(".")[0], process.versions.chrome] })

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

let scrollPointer: { x: number; y: number } | undefined
window.addEventListener("pointermove", (event) => { scrollPointer = { x: event.clientX, y: event.clientY } }, true)
window.addEventListener("pointerleave", () => { scrollPointer = undefined })
window.addEventListener("blur", () => { scrollPointer = undefined })
ipcRenderer.on("vessel:scroll-boundary", (_event, top: boolean) => {
  if (typeof top === "boolean") scrollBoundary(top, scrollPointer)
})

bindDoubleSpace(window, () => ipcRenderer.sendToHost("vessel-focus-address"))
