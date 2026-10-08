import { ipcRenderer } from "electron"
// Let the page finish handling its own shortcut before requesting the host find UI.
window.addEventListener("keydown", event => {
  if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "f") return
  setTimeout(() => {
    if (!event.defaultPrevented && !event.cancelBubble) ipcRenderer.sendToHost("vessel-find")
  }, 0)
})
