/** Reorder actual command wrappers; library builds may put the icon on the wrapper itself. */
export function arrangeScreenshotToolbar(toolbar: HTMLElement) {
  const selectors = [".shot-step", ".square", ".round", ".right-top", ".text", ".mosaicPen", ".brush", ".undo, .undo-disabled", ".close", ".shot-pin", ".save", ".confirm"]
  selectors.forEach((selector, index) => {
    const control = toolbar.querySelector<HTMLElement>(selector)?.closest<HTMLElement>(".item-panel")
    if (!control || control.parentElement !== toolbar) return
    control.style.order = String(index + 1)
    toolbar.append(control)
  })
}
