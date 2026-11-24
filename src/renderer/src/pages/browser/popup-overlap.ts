type Bounds = { left: number; right: number; top: number; bottom: number; width: number; height: number }

/** Native views only need hiding when a DOM portal actually covers their bounds. */
export function popupOverlapsPane(rect: Bounds, pane: Bounds): boolean {
  return rect.width > 0 && rect.height > 0 && rect.left < pane.right && rect.right > pane.left && rect.top < pane.bottom && rect.bottom > pane.top
}

/** Hide native DevTools behind overlapping DOM portals, including address suggestions. */
export function browserPopupOverlapsPane(pane: Bounds): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(
    '.history-completion, .vessel-browser-tabs-popup[data-state="open"], .vessel-activity-tools-popup[data-state="open"], .dev-actions-menu[data-state="open"], [role="dialog"][data-state="open"], [data-sonner-toast].vessel-browser-save-toast[data-visible="true"]:not([data-removed="true"])'
  )).some((popup) => {
    const surfaces = popup.hasAttribute("data-transit-container") ? popup.querySelectorAll<HTMLElement>(".transit-sheet") : [popup]
    return Array.from(surfaces).some(surface => popupOverlapsPane(surface.getBoundingClientRect(), pane))
  })
}
