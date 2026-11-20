import type { BrowserWindow } from "electron"

/** Keep a detached console above its owner while respecting fullscreen and preview visibility. */
export function bindBrowserDevtoolsWindow(owner: BrowserWindow, consoleWindow: BrowserWindow, enabled: () => boolean, hidden: () => boolean) {
  const sync = () => {
    if (owner.isDestroyed() || consoleWindow.isDestroyed()) return
    const follow = enabled() && !owner.isFullScreen() && !owner.isSimpleFullScreen()
    const parent = follow ? owner : null
    if (consoleWindow.getParentWindow() !== parent) consoleWindow.setParentWindow(parent)
    const visible = !hidden() && (!follow || (owner.isVisible() && !owner.isMinimized()))
    if (!visible) {
      if (consoleWindow.isVisible()) consoleWindow.hide()
    } else if (!consoleWindow.isVisible()) consoleWindow.showInactive()
  }
  const events = ["show", "hide", "focus", "minimize", "restore", "enter-full-screen", "leave-full-screen", "resize"] as const
  const ownerEvents: NodeJS.EventEmitter = owner
  for (const event of events) ownerEvents.on(event, sync)
  const dispose = () => {
    for (const event of events) ownerEvents.removeListener(event, sync)
    consoleWindow.removeListener("closed", dispose)
  }
  consoleWindow.once("closed", dispose)
  return { sync, dispose }
}
