/** Runs before page scripts in the main world; preserve a site's own context-menu behavior. */
export function installBrowserContextMenu() {
  if (window.top !== window) return
  window.addEventListener("contextmenu", (event: MouseEvent) => {
    if (!event.isTrusted) return
    // Check after dispatch: a registered listener alone does not replace the browser menu.
    // Capture here so stopPropagation() without preventDefault() still gets the fallback.
    setTimeout(() => {
      if (event.defaultPrevented) return
      ;(window as unknown as { vesselContextMenu?: (details: object) => void }).vesselContextMenu?.({ x: event.clientX, y: event.clientY })
    }, 0)
  }, true)
}
