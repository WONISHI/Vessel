import type { WebviewTag } from "electron"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import { floatingVideoGuest } from "./floating-video-guest"

type Bounds = { top: number; right: number; bottom: number; left: number; width: number; height: number }
let activeGuest: WebviewTag | undefined
let frame = 0
let shadow: HTMLDivElement | undefined

function clearOverlay(guest: WebviewTag) {
  shadow?.remove()
  shadow = undefined
  delete guest.dataset.floatingVideoOverlay
  guest.style.removeProperty("--floating-video-clip")
}

export function setFloatingGuest(guest: WebviewTag | undefined) {
  if (guest === activeGuest) return
  cancelAnimationFrame(frame)
  if (activeGuest) {
    clearOverlay(activeGuest)
    void withGuest(activeGuest, (view) => view.executeJavaScript(
      `(${floatingVideoGuest.toString()})("close")`
    ).catch(() => {}))
  }
  activeGuest = guest
  if (!guest) return

  // Keep the original guest mounted. Only its player rectangle is painted
  // and receives pointer input while the source tab is hidden.
  const update = async () => {
    if (activeGuest !== guest) return
    if (!guest.isConnected) {
      setFloatingGuest(undefined)
      return
    }
    if (guest.style.display !== "none") {
      clearOverlay(guest)
    } else {
      const bounds = await withGuest(guest, (view) => view.executeJavaScript(
        `(${floatingVideoGuest.toString()})("bounds")`
      ).catch(() => null)) as Bounds | null | undefined
      if (activeGuest !== guest) return
      if (!bounds) {
        setFloatingGuest(undefined)
        return
      }
      if (guest.style.display === "none") {
        const { top, right, bottom, left, width, height } = bounds
        if (width > 0 && height > 0 && right > left && bottom > top) {
          const inset = `${top / height * 100}% ${(width - right) / width * 100}% ${(height - bottom) / height * 100}% ${left / width * 100}%`
          guest.style.setProperty("--floating-video-clip", `inset(${inset} round 12px)`)
          // Paint outside the clipped guest without expanding its hit area.
          if (!shadow) {
            shadow = document.createElement("div")
            shadow.className = "browser-floating-video-shadow"
            shadow.setAttribute("aria-hidden", "true")
            document.body.append(shadow)
          }
          shadow.style.inset = inset
          shadow.hidden = false
        } else {
          guest.style.setProperty("--floating-video-clip", "inset(50%)")
          if (shadow) shadow.hidden = true
        }
        guest.dataset.floatingVideoOverlay = ""
      }
    }
    frame = requestAnimationFrame(() => void update())
  }
  frame = requestAnimationFrame(() => void update())
}
