import { Stroke } from "@/components/pdf-document/components/pdf-document-shared"
import { useEffect, useRef, useState } from "react"
import { Page } from "react-pdf"

/** Renders the lazy page component. */
export function LazyPage({ number, width, strokes, tool, color, penWidth, add, erase }: { number: number; width: number; strokes: Stroke[]; tool: string; color: string; penWidth: number; add: (stroke: Stroke) => void; erase: (id: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false),
    [ratio, setRatio] = useState(1.414)
  const [draft, setDraft] = useState<Stroke | null>(null)
  const current = useRef<Stroke | null>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root: host.current?.closest("[data-radix-scroll-area-viewport]"), rootMargin: "700px" })
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])

  /** Performs the path operation. */
  const path = (stroke: Stroke) => stroke.points.map(([x, y]) => `${x * width},${y * width * ratio}`).join(" ")
  return (
    <div
      ref={host}
      className="relative mx-auto mb-4 shrink-0 bg-white shadow"
      style={{ width, height: width * ratio }}
      aria-label={`第 ${number} 页`}
    >
      {visible && (
        <Page
          pageNumber={number}
          width={width}
          onLoadSuccess={(page) => {
            const viewport = page.getViewport({ scale: 1 })
            setRatio(viewport.height / viewport.width)
          }}
          loading={<p className="p-4 text-sm">正在加载第 {number} 页…</p>}
        />
      )}
      <svg
        className="absolute inset-0"
        width={width}
        height={width * ratio}
        style={{ pointerEvents: tool === "view" ? "none" : "auto", touchAction: tool === "view" ? "auto" : "none", cursor: tool === "pen" ? "crosshair" : "default" }}
        onPointerDown={(event) => {
          if (tool !== "pen" || event.button !== 0) return
          event.preventDefault()
          event.currentTarget.setPointerCapture(event.pointerId)
          const rect = event.currentTarget.getBoundingClientRect()
          current.current = { id: crypto.randomUUID(), page: number, color, width: penWidth / width, points: [[(event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height]] }
          setDraft(current.current)
        }}
        onPointerMove={(event) => {
          if (!current.current) return
          const rect = event.currentTarget.getBoundingClientRect()
          const point: [number, number] = [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))]
          current.current = { ...current.current, points: [...current.current.points, point] }
          setDraft(current.current)
        }}
        onPointerUp={() => {
          if (current.current) {
            add(current.current)
            current.current = null
            setDraft(null)
          }
        }}
        onPointerCancel={() => {
          current.current = null
          setDraft(null)
        }}
      >
        {[...strokes, ...(draft ? [draft] : [])].map((stroke) => (
          <polyline
            key={stroke.id}
            points={path(stroke)}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width * width}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: tool === "erase" ? "stroke" : "none" }}
            onPointerDown={(event) => {
              if (tool === "erase") {
                event.stopPropagation()
                erase(stroke.id)
              }
            }}
          />
        ))}
      </svg>
    </div>
  )
}
