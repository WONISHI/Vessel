const pending = new WeakMap<HTMLElement, () => void>()

/** Cancels deferred caret restoration when the editor is replaced or destroyed. */
export function cancelInsertFocus(editable: HTMLElement) {
  pending.get(editable)?.()
}

/** Restores the caret after menu teardown, keeping only the latest pending request. */
export function scheduleInsertFocus(editable: HTMLElement, focus: () => void) {
  cancelInsertFocus(editable)
  let frame: number | undefined
  const timer = setTimeout(() => {
    frame = requestAnimationFrame(() => {
      pending.delete(editable)
      if (editable.isConnected) focus()
    })
  }, 0)
  pending.set(editable, () => {
    clearTimeout(timer)
    if (frame !== undefined) cancelAnimationFrame(frame)
    pending.delete(editable)
  })
}
