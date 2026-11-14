import { ipcRenderer } from "electron"

type Control = { x: number; y: number; width: number; height: number; icon: string; color: string; background: string; border: string; shadow: string }
let control: Control | undefined
let button: HTMLButtonElement | undefined
let disposeControl: (() => void) | undefined

// A native WebContentsView covers host DOM regardless of its z-index. Mirror the
// existing control in this surface; its menu still belongs to the host renderer.
function renderControl() {
  if (!document.body) return
  if (!control) {
    disposeControl?.()
    disposeControl = undefined
    button?.remove()
    button = undefined
    return
  }
  if (!button) {
    button = document.createElement("button")
    button.setAttribute("aria-label", "控制台菜单")
    button.title = "控制台菜单"
    let held = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let last: { x: number; y: number } | undefined
    button.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return
      held = false
      last = { x: event.screenX, y: event.screenY }
      button!.setPointerCapture(event.pointerId)
      timer = setTimeout(() => { held = true }, 350)
    })
    button.addEventListener("pointermove", (event) => {
      if (!last) return
      const dx = event.screenX - last.x, dy = event.screenY - last.y
      if (held) {
        ipcRenderer.send("browser:devtools-control", { dx, dy })
        last = { x: event.screenX, y: event.screenY }
      } else if (Math.hypot(dx, dy) > 5) clearTimeout(timer)
    })
    const stop = () => { clearTimeout(timer); last = undefined }
    button.addEventListener("pointerup", stop)
    button.addEventListener("pointercancel", stop)
    window.addEventListener("blur", stop)
    disposeControl = () => { stop(); window.removeEventListener("blur", stop) }
    button.addEventListener("contextmenu", (event) => event.preventDefault())
    button.addEventListener("click", () => {
      if (!held) ipcRenderer.send("browser:devtools-control")
      held = false
    })
    document.body.append(button)
  }
  Object.assign(button.style, {
    position: "fixed", zIndex: "2147483647", left: `${control.x}px`, top: `${control.y}px`,
    width: `${control.width}px`, height: `${control.height}px`, borderRadius: "50%",
    border: `1px solid ${control.border}`, background: control.background, color: control.color,
    boxShadow: control.shadow, display: "grid", placeItems: "center", padding: "0", cursor: "pointer"
  })
  // SVG is an image URL, so its contents cannot execute scripts in DevTools.
  const image = document.createElement("img")
  image.src = `data:image/svg+xml,${encodeURIComponent(control.icon.replace('<svg ', `<svg color="${control.color}" `))}`
  image.style.cssText = `width:${control.width * 28 / 48}px;height:${control.height * 28 / 48}px;pointer-events:none`
  button.replaceChildren(image)
}
ipcRenderer.on("browser:control-overlay", (_event, next: Control | undefined) => {
  control = next
  renderControl()
})
window.addEventListener("DOMContentLoaded", renderControl)
