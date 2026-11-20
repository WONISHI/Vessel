export type PinDrag = { phase: "start" | "move" | "end"; x: number; y: number }

/** Keep image dragging independent of Electron's draggable regions so right-clicks reach the menu. */
export function installPinImageInteractions(image: HTMLImageElement, api: { pinMenu(): Promise<void>; pinDrag(value: PinDrag): Promise<void> }, onError: (error: unknown) => void) {
  let pointer: number | undefined
  const drag = (phase: PinDrag["phase"], event: PointerEvent) => {
    void api.pinDrag({ phase, x: event.screenX, y: event.screenY }).catch(onError)
  }
  image.addEventListener("contextmenu", (event) => {
    event.preventDefault()
    event.stopPropagation()
    void api.pinMenu().catch(onError)
  })
  image.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || pointer !== undefined) return
    event.preventDefault()
    pointer = event.pointerId
    image.setPointerCapture(pointer)
    drag("start", event)
  })
  image.addEventListener("pointermove", (event) => {
    if (pointer === event.pointerId) drag("move", event)
  })
  const end = (event: PointerEvent) => {
    if (pointer !== event.pointerId) return
    pointer = undefined
    drag("end", event)
    if (image.hasPointerCapture(event.pointerId)) image.releasePointerCapture(event.pointerId)
  }
  image.addEventListener("pointerup", end)
  image.addEventListener("pointercancel", end)
  image.addEventListener("lostpointercapture", end)
}
