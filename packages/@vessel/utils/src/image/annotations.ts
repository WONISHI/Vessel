import type { Shape } from "@vessel/type/image-annotation"

/** Performs the arrow head operation. */
export const arrowHead = (a: { x: number; y: number }, b: { x: number; y: number }, width: number) => {
  const angle = Math.atan2(b.y - a.y, b.x - a.x),
    len = Math.max(10, width * 4)
  return [
    { x: b.x - len * Math.cos(angle - Math.PI / 6), y: b.y - len * Math.sin(angle - Math.PI / 6) },
    { x: b.x - len * Math.cos(angle + Math.PI / 6), y: b.y - len * Math.sin(angle + Math.PI / 6) }
  ]
}

/** Draws shape. */
export function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  const a = s.points[0],
    b = s.points[s.points.length - 1]
  ctx.beginPath()
  if (s.kind === "pen") {
    ctx.moveTo(a.x, a.y)
    s.points.forEach((p) => ctx.lineTo(p.x, p.y))
  } else if (s.kind === "rect") ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
  else if (s.kind === "ellipse") ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2)
  else if (s.kind === "arrow") {
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    const [h1, h2] = arrowHead(a, b, s.width)
    ctx.moveTo(h1.x, h1.y)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(h2.x, h2.y)
  } else if (s.kind === "text") {
    ctx.font = `${s.size}px sans-serif`
    ctx.textBaseline = "top"
    ctx.fillText(s.text || "", a.x, a.y)
    return
  }
  ctx.stroke()
}
