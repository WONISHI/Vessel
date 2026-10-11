import { contextBridge, ipcRenderer } from "electron"
// Narrow page-world bridge: reports state, never input values or page contents.
contextBridge.exposeInMainWorld("vesselPageBridge", {
  report: (kind: string, value: unknown) => {
    if (["focus", "search-handled", "find"].includes(kind) && typeof value === "boolean") ipcRenderer.sendToHost(`vessel-${kind}`, value)
    if (kind === "navigation" && typeof value === "string" && value.length < 16384) ipcRenderer.sendToHost("vessel-navigation", value)
  },
  navigate: (url: string) => typeof url === "string" && url.length < 16384 && ipcRenderer.sendSync("vessel:navigation-choice", url) === true
})

// Mark link activation before its default navigation or SPA handler runs.
const linkActivation = (event: MouseEvent) => {
  const link = event.composedPath().find(node => node instanceof HTMLAnchorElement && node.hasAttribute("href")) as HTMLAnchorElement | undefined
  if (link) ipcRenderer.sendSync("vessel:anchor-navigation", link.href)
}
window.addEventListener("click", linkActivation, true)
window.addEventListener("auxclick", linkActivation, true)
