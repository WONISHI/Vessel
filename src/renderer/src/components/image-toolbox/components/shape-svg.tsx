import { Shape, arrowHead } from "@/components/image-toolbox/components/image-toolbox-shared"

/** Renders the shape svg component. */
export function ShapeSvg({ s }: { s: Shape }) {
  const a = s.points[0],
    b = s.points[s.points.length - 1]
  const stroke = { stroke: s.color, strokeWidth: s.width, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const }
  if (s.kind === "pen")
    return (
      <polyline
        points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
        {...stroke}
      />
    )
  if (s.kind === "rect")
    return (
      <rect
        x={Math.min(a.x, b.x)}
        y={Math.min(a.y, b.y)}
        width={Math.abs(b.x - a.x)}
        height={Math.abs(b.y - a.y)}
        {...stroke}
      />
    )
  if (s.kind === "ellipse")
    return (
      <ellipse
        cx={(a.x + b.x) / 2}
        cy={(a.y + b.y) / 2}
        rx={Math.abs(b.x - a.x) / 2}
        ry={Math.abs(b.y - a.y) / 2}
        {...stroke}
      />
    )
  if (s.kind === "arrow") {
    const [h1, h2] = arrowHead(a, b, s.width)
    return (
      <path
        d={`M${a.x},${a.y} L${b.x},${b.y} M${h1.x},${h1.y} L${b.x},${b.y} L${h2.x},${h2.y}`}
        {...stroke}
      />
    )
  }
  return (
    <text
      x={a.x}
      y={a.y}
      fontSize={s.size}
      fill={s.color}
      dominantBaseline="hanging"
      fontFamily="sans-serif"
    >
      {s.text}
    </text>
  )
}
