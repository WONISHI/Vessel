import { matchesShortcut } from "../shared/shortcuts"
import { ipcRenderer } from "electron"
// Let the page finish handling its own shortcut before requesting the host find UI.
window.addEventListener("keydown", event => {
  if (!matchesShortcut(event, "find")) return
  setTimeout(() => {
    if (!event.defaultPrevented && !event.cancelBubble) ipcRenderer.sendToHost("vessel-find")
  }, 0)
})
