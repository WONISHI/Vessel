import { afterEach, expect, it, vi } from "vitest"
import { lazyPreviews } from "@/components/core/canvas/variants/markdown/lazy-previews"
afterEach(() => vi.unstubAllGlobals())
it("defers hundreds of offscreen previews and mounts only intersecting slots once", () => {
  let deliver: IntersectionObserverCallback
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn()
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { deliver = callback }
    observe = observe; unobserve = unobserve; disconnect = disconnect
  })
  const mount = vi.fn()
  const previews = lazyPreviews(mount)
  const host = document.createElement("div")
  document.body.append(host)
  const slots = Array.from({ length: 332 }, () => { const slot = document.createElement("div"); host.append(slot); return slot })
  try {
    slots.forEach((slot) => previews.enqueue(slot))
    expect(mount).not.toHaveBeenCalled()
    expect(observe).toHaveBeenCalledTimes(332)
    deliver!([{ target: slots[0], isIntersecting: true }, { target: slots[1], isIntersecting: false }] as IntersectionObserverEntry[], {} as IntersectionObserver)
    expect(mount).toHaveBeenCalledExactlyOnceWith(slots[0])
    expect(slots[0].classList.contains("vessel-preview-pending")).toBe(false)
    expect(slots[1].classList.contains("vessel-preview-pending")).toBe(true)
    deliver!([{ target: slots[0], isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver)
    expect(mount).toHaveBeenCalledTimes(1)
  } finally { previews.dispose(); host.remove() }
  expect(disconnect).toHaveBeenCalledOnce()
})
