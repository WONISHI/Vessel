export type Step = { x: number; y: number; number: number; tipX?: number; tipY?: number; radius?: number; text?: string; color?: string }
export type CutBox = { startX: number; startY: number; width: number; height: number }
export const STEP_RADIUS = 15
export const STEP_CAPTION_FONT_SIZE = 12
export const STEP_CAPTION_LINE_HEIGHT = 16
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(Math.max(min, max), value))

export function stepPointer(step: Step) {
  if (step.tipX !== undefined && step.tipY !== undefined) return { x: step.tipX, y: step.tipY }
  return { x: step.x + 23, y: step.y + 25 }
}

export function clampStepCenter(point: { x: number; y: number }, box: CutBox, radius = STEP_RADIUS) {
  const insetX = Math.min(radius + 2, box.width / 2), insetY = Math.min(radius + 2, box.height / 2)
  return {
    x: clamp(point.x, box.startX + insetX, box.startX + box.width - insetX),
    y: clamp(point.y, box.startY + insetY, box.startY + box.height - insetY)
  }
}

/** The clicked point is the beak tip; flip the badge around that point at crop edges. */
export function createStepAt(point: { x: number; y: number }, box: CutBox, number: number, color: string): Step {
  const tipX = clamp(point.x, box.startX, box.startX + box.width)
  const tipY = clamp(point.y, box.startY, box.startY + box.height)
  const radius = Math.min(STEP_RADIUS, Math.max(0.5, Math.min(box.width, box.height) / 2 - 2))
  const reach = radius * (34 / STEP_RADIUS)
  const candidates = [[1, -1], [-1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => ({ x: tipX + dx * reach * 0.68, y: tipY + dy * reach * 0.74 }))
  const preferred = candidates.find((candidate) => {
    const clamped = clampStepCenter(candidate, box, radius)
    return candidate.x === clamped.x && candidate.y === clamped.y
  })
  const center = preferred ?? candidates.map((candidate) => clampStepCenter(candidate, box, radius)).sort((a, b) => Math.hypot(b.x - tipX, b.y - tipY) - Math.hypot(a.x - tipX, a.y - tipY))[0]
  return { ...center, tipX, tipY, radius, number, color }
}

/** Share caption wrapping/placement between the editor, canvas preview and exported PNG. */
export function stepCaptionLayout(step: Step, box: CutBox, measure: (text: string) => number) {
  const padding = Math.min(2, box.width / 8, box.height / 8)
  const left = box.startX + padding, top = box.startY + padding
  const right = box.startX + box.width - padding, bottom = box.startY + box.height - padding
  const width = Math.max(1, Math.min(144, right - left))
  const lines: string[] = []
  let line = ""
  for (const char of step.text ?? "") {
    if (char === "\n" || (line && measure(line + char) > Math.max(1, width - 8))) {
      lines.push(line)
      line = char === "\n" ? "" : char
    } else line += char
  }
  lines.push(line)
  const height = Math.max(1, Math.min(Math.max(48, lines.length * STEP_CAPTION_LINE_HEIGHT + 8), bottom - top))
  const radius = step.radius ?? STEP_RADIUS
  const rightX = step.x + radius + 6, leftX = step.x - radius - 6 - width
  const x = rightX + width <= right ? rightX : leftX >= left ? leftX : clamp(rightX, left, right - width)
  const y = clamp(step.y - radius + 3, top, bottom - height)
  return { x, y, width, height, lines }
}
