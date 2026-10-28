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
  const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.hasAttribute("href")) as HTMLAnchorElement | undefined
  if (link) ipcRenderer.sendSync("vessel:anchor-navigation", link.href)
}
window.addEventListener("click", linkActivation, true)
window.addEventListener("auxclick", linkActivation, true)
