import type { WebContents } from "electron"

/** Chromium emits this for Ctrl+wheel, including wheel input over child frames. */
export function registerBrowserWheelZoom(guest: WebContents) {
  guest.on("zoom-changed", (_event, direction) => {
    const value = Math.max(0.5, Math.min(2, Math.round((guest.getZoomFactor() + (direction === "in" ? 0.1 : -0.1)) * 100) / 100))
    guest.setZoomFactor(value)
    guest.send("vessel:zoom-changed", value)
  })
}
