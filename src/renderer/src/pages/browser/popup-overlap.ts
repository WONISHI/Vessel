type Bounds = { left: number; right: number; top: number; bottom: number; width: number; height: number }

/** Native views only need hiding when a DOM portal actually covers their bounds. */
export function popupOverlapsPane(rect: Bounds, pane: Bounds): boolean {
  return rect.width > 0 && rect.height > 0 && rect.left < pane.right && rect.right > pane.left && rect.top < pane.bottom && rect.bottom > pane.top
}
