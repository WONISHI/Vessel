/** Two distinct Space presses outside editable fields; holding Space never triggers it. */
export function bindDoubleSpace(target: Window, activate: () => void, { allowButtons = false }: { allowButtons?: boolean } = {}) {
  let previous = 0
  const reset = () => { previous = 0 }
  const key = (event: KeyboardEvent) => {
    const element = event.composedPath().find((node) => node instanceof HTMLElement) as HTMLElement | undefined
    if (event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || element?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],video,audio') || (!allowButtons && element?.closest('button'))) { reset(); return }
    if (event.code !== 'Space' || event.defaultPrevented) { reset(); return }
    if (event.repeat) return
    if (allowButtons && element?.closest("button")) event.preventDefault()
    const now = performance.now()
    if (previous && now - previous <= 350) {
      reset()
      event.preventDefault()
      event.stopImmediatePropagation()
      activate()
    } else previous = now
  }
  target.addEventListener('keydown', key, true)
  target.addEventListener('blur', reset)
  return () => {
    target.removeEventListener('keydown', key, true)
    target.removeEventListener('blur', reset)
  }
}
