export interface VirtualRange { start: number; end: number }

/** Keep two viewports behind and extra rows ahead of the current scroll direction. */
export function virtualTreeRange(top: number, height: number, count: number, rowHeight: number, overscan: number, direction = 0, travel = 0): VirtualRange {
  const visible = Math.max(1, Math.ceil(height / rowHeight))
  const buffer = Math.max(overscan, visible * 2)
  const ahead = direction ? Math.max(buffer, Math.min(visible * 8, visible * 4 + Math.ceil(Math.abs(travel) / rowHeight))) : buffer
  const clamped = Math.max(0, Math.min(top, Math.max(0, count * rowHeight - height)))
  return { start: Math.max(0, Math.floor(clamped / rowHeight) - (direction < 0 ? ahead : buffer)), end: Math.min(count, Math.ceil((clamped + height) / rowHeight) + (direction > 0 ? ahead : buffer)) }
}

/** Refills before the viewport reaches an unrendered edge, without updating every pixel. */
export function virtualRangeNeedsUpdate(range: VirtualRange, top: number, height: number, count: number, rowHeight: number, guard: number): boolean {
  const clamped = Math.max(0, Math.min(top, Math.max(0, count * rowHeight - height)))
  const first = Math.max(0, Math.floor(clamped / rowHeight))
  const last = Math.min(count, Math.ceil((clamped + height) / rowHeight))
  return (range.start > 0 && first - range.start < guard) || (range.end < count && range.end - last < guard) || first < range.start || last > range.end
}
