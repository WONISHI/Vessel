const pending = new WeakMap<HTMLElement, () => void>()

/** Reveal in the editor only, correcting short-lived layout shifts after rendering. */
export function revealMarkdownElement(target: HTMLElement) {
  const editable = target.closest<HTMLElement>('.vditor-reset')
  if (editable) {
    // A search result may belong to a folded section.
    editable.querySelectorAll('.vessel-heading-folded').forEach((node) => node.classList.remove('vessel-heading-folded'))
    editable.querySelectorAll('.vessel-heading-fold-hidden').forEach((node) => node.classList.remove('vessel-heading-fold-hidden'))
    editable.dispatchEvent(new CustomEvent('vessel:heading-fold', { bubbles: true }))
  }
  let scroller = target.parentElement
  while (scroller && !(/auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement
  if (!scroller) { target.scrollIntoView({ block: 'center', behavior: 'instant' }); return }
  const viewport = scroller
  pending.get(viewport)?.()
  let frame = 0
  const started = performance.now()
  const cancel = () => {
    cancelAnimationFrame(frame)
    viewport.removeEventListener('vessel:cancel-reveal', cancel)
    viewport.removeEventListener('wheel', cancel)
    viewport.removeEventListener('touchstart', cancel)
    viewport.removeEventListener('pointerdown', cancel)
    window.removeEventListener('keydown', cancel)
    if (pending.get(viewport) === cancel) pending.delete(viewport)
  }
  const align = () => {
    if (!target.isConnected || !viewport.isConnected) { cancel(); return }
    const box = viewport.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    const delta = rect.top - box.top - (viewport.clientHeight - Math.min(rect.height, viewport.clientHeight)) / 2
    if (Math.abs(delta) > 1) viewport.scrollTo({ top: viewport.scrollTop + delta, behavior: 'instant' })
    if (performance.now() - started < 900) frame = requestAnimationFrame(align)
    else cancel()
  }
  pending.set(viewport, cancel)
  viewport.addEventListener('vessel:cancel-reveal', cancel)
  viewport.addEventListener('wheel', cancel, { passive: true })
  viewport.addEventListener('touchstart', cancel, { passive: true })
  viewport.addEventListener('pointerdown', cancel)
  window.addEventListener('keydown', cancel)
  align()
}
