import { matchesShortcut } from '../../../shared/shortcuts'

export function installScrollShortcuts() {
  let pointer: { x: number; y: number } | undefined
  const move = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY } }
  const clear = () => { pointer = undefined }
  const key = (event: KeyboardEvent) => {
    const top = matchesShortcut(event, 'scrollTop')
    if (!top && !matchesShortcut(event, 'scrollBottom')) return
    const hovered = pointer ? document.elementFromPoint(pointer.x, pointer.y) : null
    const container = hovered?.closest('[data-vessel-scroll]') ?? document.activeElement?.closest('[data-vessel-scroll]')
    if (!(container instanceof HTMLElement)) return
    if (container.dataset.vesselScroll === 'code') {
      container.dispatchEvent(new CustomEvent('vessel:scroll-boundary', { detail: top }))
    } else {
      const viewport = container.querySelector<HTMLElement>('[data-radix-scroll-area-viewport]')
      if (!viewport) return
      viewport.scrollTo({ top: top ? 0 : viewport.scrollHeight, behavior: 'smooth' })
    }
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  document.addEventListener('pointermove', move, true)
  document.addEventListener('pointerleave', clear)
  window.addEventListener('blur', clear)
  window.addEventListener('keydown', key, true)
  return () => {
    document.removeEventListener('pointermove', move, true)
    document.removeEventListener('pointerleave', clear)
    window.removeEventListener('blur', clear)
    window.removeEventListener('keydown', key, true)
  }
}
