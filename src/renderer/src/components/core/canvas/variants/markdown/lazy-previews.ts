/** Defer expensive React previews until near the visible editor viewport. */
export function lazyPreviews(mount: (element: HTMLElement) => void) {
  const pending = new Set<HTMLElement>()
  const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement
      if (!entry.isIntersecting || !pending.delete(element)) continue
      observer?.unobserve(element)
      element.classList.remove("vessel-preview-pending")
      mount(element)
    }
  }, { rootMargin: "600px 0px" })
  return {
    enqueue(element: HTMLElement) {
      if (!observer || element.querySelector(".vessel-image-component")) { mount(element); return }
      if (pending.has(element)) return
      // Discard nodes removed by edits; the observer must not retain old documents.
      for (const node of pending.size % 128 === 0 ? pending : []) if (!node.isConnected) { observer.unobserve(node); pending.delete(node) }
      pending.add(element)
      element.classList.add("vessel-preview-pending")
      observer.observe(element)
    },
    dispose() {
      observer?.disconnect()
      pending.clear()
    }
  }
}
