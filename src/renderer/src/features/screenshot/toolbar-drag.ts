/** Drag only by the grip, without starting a new screenshot selection. */
export function installToolbarDrag(toolbar: HTMLElement, grip: HTMLElement) {
  let drag: { id: number; x: number; y: number; left: number; top: number } | undefined
  const stop = (event: Event) => event.stopPropagation()
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const rect = toolbar.getBoundingClientRect()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
    grip.setPointerCapture(event.pointerId)
    grip.classList.add("is-dragging")
  }
  const move = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return
    event.preventDefault()
    event.stopPropagation()
    const rect = toolbar.getBoundingClientRect()
    const left = Math.max(8, Math.min(innerWidth - rect.width - 8, drag.left + event.clientX - drag.x))
    const top = Math.max(8, Math.min(innerHeight - rect.height - 8, drag.top + event.clientY - drag.y))
    for (const id of ["optionPanel", "optionIcoController"]) {
      const panel = document.getElementById(id)
      if (!panel || !panel.getClientRects().length) continue
      const box = panel.getBoundingClientRect()
      const parent = (panel.offsetParent as HTMLElement | null)?.getBoundingClientRect()
      panel.style.left = `${box.left + left - rect.left - (parent?.left || 0)}px`
      panel.style.top = `${box.top + top - rect.top - (parent?.top || 0)}px`
    }
    toolbar.style.left = `${left}px`
    toolbar.style.top = `${top}px`
    toolbar.style.right = "auto"
    toolbar.style.bottom = "auto"
    window.dispatchEvent(new Event("vessel:screenshot-toolbar-moved"))
  }
  const up = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.id) return
    event.stopPropagation()
    drag = undefined
    grip.classList.remove("is-dragging")
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId)
  }
  grip.addEventListener("pointerdown", down)
  grip.addEventListener("pointermove", move)
  grip.addEventListener("pointerup", up)
  grip.addEventListener("pointercancel", up)
  grip.addEventListener("mousedown", stop)
  grip.addEventListener("click", stop)
  return () => {
    grip.removeEventListener("pointerdown", down)
    grip.removeEventListener("pointermove", move)
    grip.removeEventListener("pointerup", up)
    grip.removeEventListener("pointercancel", up)
    grip.removeEventListener("mousedown", stop)
    grip.removeEventListener("click", stop)
  }
}
