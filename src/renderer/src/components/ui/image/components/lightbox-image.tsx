import { useRef, useState } from "react"
import { useCtrlWheelZoom } from "@/hooks/use-ctrl-wheel-zoom"

/** Keep enlarged pixels inside a scrollable viewport, including in small preview windows. */
export function LightboxImage({ src, srcSet, alt, rotation, maxWidth }: { src?: string; srcSet?: string; alt: string; rotation: number; maxWidth: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const [width, setWidth] = useState<number>()
  useCtrlWheelZoom(viewport, (direction) => {
    setWidth((value) => Math.max(40, Math.min(16000, (value ?? image.current?.getBoundingClientRect().width ?? 480) * (direction > 0 ? 1.25 : 0.8))))
  })
  return <div ref={viewport} className="min-h-0 min-w-0 overflow-auto" style={{ maxWidth, maxHeight: "85vh" }}>
    <img ref={image} src={src} srcSet={srcSet} alt={alt} className="block object-contain" style={{ width, height: "auto", maxWidth: width === undefined ? "100%" : "none", maxHeight: width === undefined ? "85vh" : "none", transform: `rotate(${rotation}deg)` }} />
  </div>
}
