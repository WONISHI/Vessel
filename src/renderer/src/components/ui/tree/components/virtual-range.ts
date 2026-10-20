export interface VirtualRange { start: number; end: number }

/** Keeps at least one viewport of rows ready on both sides of the visible range. */
export function virtualTreeRange(top: number, height: number, count: number, rowHeight: number, overscan: number): VirtualRange {
  const visible = Math.max(1, Math.ceil(height / rowHeight))
  const buffer = Math.max(overscan, visible)
  const clamped = Math.max(0, Math.min(top, Math.max(0, count * rowHeight - height)))
  return { start: Math.max(0, Math.floor(clamped / rowHeight) - buffer), end: Math.min(count, Math.ceil((clamped + height) / rowHeight) + buffer) }
}

/** Refills before the viewport reaches an unrendered edge, without updating every pixel. */
export function virtualRangeNeedsUpdate(range: VirtualRange, top: number, height: number, count: number, rowHeight: number, guard: number): boolean {
  const first = Math.max(0, Math.floor(top / rowHeight))
  const last = Math.min(count, Math.ceil((top + height) / rowHeight))
  return (range.start > 0 && first - range.start < guard) || (range.end < count && range.end - last < guard) || first < range.start || last > range.end
}
