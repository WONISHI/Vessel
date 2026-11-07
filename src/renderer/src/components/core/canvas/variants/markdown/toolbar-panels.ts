/** Keeps native Vditor pickers and custom toolbar panels mutually exclusive. */
export function bindToolbarPanels(toolbar: HTMLElement) {
  const selector = ".vditor-panel, .vditor-hint"
  const observer = new MutationObserver((records) => {
    const opened = records.filter((record) => {
      const target = record.target
      if (!(target instanceof HTMLElement) || !target.matches(selector)) return false
      const wasHidden = /display\s*:\s*none/.test(record.oldValue ?? "") || record.oldValue === null
      return wasHidden && target.style.display !== "none" && target.getClientRects().length > 0
    })
    const panel = opened.at(-1)?.target
    if (!(panel instanceof HTMLElement)) return
    toolbar.querySelectorAll<HTMLElement>(selector).forEach((other) => {
      if (other !== panel && !other.contains(panel) && !panel.contains(other)) other.style.display = "none"
    })
    window.dispatchEvent(new Event("vessel:toolbar-panel-open"))
  })
  observer.observe(toolbar, { subtree: true, attributes: true, attributeFilter: ["style"], attributeOldValue: true })
  return () => observer.disconnect()
}
