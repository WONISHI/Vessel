import type { BrowserWindow } from "electron"

/** Keep a detached console above its owner while respecting fullscreen and preview visibility. */
export function bindBrowserDevtoolsWindow(owner: BrowserWindow, consoleWindow: BrowserWindow, enabled: () => boolean, hidden: () => boolean) {
  let bounds = consoleWindow.getBounds()
  let pinned = false
  let fullscreenVisible = false
  let blurTimer: ReturnType<typeof setTimeout> | undefined
  const rememberBounds = () => {
    if (!consoleWindow.isDestroyed() && consoleWindow.isVisible()) bounds = consoleWindow.getBounds()
  }
  const restoreBounds = () => {
    const current = consoleWindow.getBounds()
    if ((["x", "y", "width", "height"] as const).some((key) => current[key] !== bounds[key])) consoleWindow.setBounds(bounds)
  }
  const sync = () => {
    if (owner.isDestroyed() || consoleWindow.isDestroyed()) return
    clearTimeout(blurTimer)
    const fullscreen = owner.isFullScreen() || owner.isSimpleFullScreen()
    const follow = enabled() && !fullscreen
    const parent = follow ? owner : null
    if (consoleWindow.getParentWindow() !== parent) {
      rememberBounds()
      const savedBounds = bounds
      consoleWindow.setParentWindow(parent)
      bounds = savedBounds
      restoreBounds()
    }
    const visible = !hidden() && owner.isVisible() && !owner.isMinimized() && (owner.isFocused() || consoleWindow.isFocused())
    if (!visible) {
      rememberBounds()
      if (consoleWindow.isVisible()) consoleWindow.hide()
    }
    // A normal child window cannot appear above a native macOS fullscreen space.
    // Keep fullscreen support stable across app switches; the window itself is hidden in the background.
    if (process.platform === "darwin" && fullscreenVisible !== fullscreen) {
      fullscreenVisible = fullscreen
      consoleWindow.setVisibleOnAllWorkspaces(fullscreen, { visibleOnFullScreen: fullscreen, skipTransformProcessType: true })
    }
    if (pinned !== visible) {
      pinned = visible
      consoleWindow.setAlwaysOnTop(visible, "floating")
    }
    if (visible && !consoleWindow.isVisible()) {
      restoreBounds()
      consoleWindow.showInactive()
      restoreBounds()
    }
  }
  // Focus moves from the owner to DevTools through a brief period where neither
  // window is focused. Wait for that handoff before deciding the app is inactive.
  const blur = () => {
    clearTimeout(blurTimer)
    blurTimer = setTimeout(sync, 50)
  }
  const events = ["show", "hide", "focus", "minimize", "restore", "enter-full-screen", "leave-full-screen", "resize"] as const
  const ownerEvents: NodeJS.EventEmitter = owner
  for (const event of events) ownerEvents.on(event, sync)
  owner.on("blur", blur)
  consoleWindow.on("blur", blur)
  consoleWindow.on("focus", sync)
  consoleWindow.on("move", rememberBounds)
  consoleWindow.on("resize", rememberBounds)
  const dispose = () => {
    clearTimeout(blurTimer)
    for (const event of events) ownerEvents.removeListener(event, sync)
    owner.removeListener("blur", blur)
    consoleWindow.removeListener("blur", blur)
    consoleWindow.removeListener("focus", sync)
    consoleWindow.removeListener("move", rememberBounds)
    consoleWindow.removeListener("resize", rememberBounds)
    consoleWindow.removeListener("closed", dispose)
    if (!consoleWindow.isDestroyed()) {
      if (pinned) consoleWindow.setAlwaysOnTop(false)
      if (fullscreenVisible) consoleWindow.setVisibleOnAllWorkspaces(false)
    }
  }
  consoleWindow.once("closed", dispose)
  return { sync, dispose }
}
