import { Shape, allTools, annotateTools } from "@/components/image-toolbox/components/image-toolbox-shared"
import { type ImageRegion } from "@vessel/utils/image/operations"
import { useEffect, useRef, useState } from "react"
import type { ImageToolboxProps } from "@/components/image-toolbox/types"

/** 图片工具箱的全部状态、视口监听与派生值 */
export function useImageToolboxState({ initialTool, navigationOpen, onNavigationChange }: ImageToolboxProps) {
  const originalImage = useRef("")
  const backgroundEdit = useRef<{ source: string; result: string } | null>(null)
  const [localNav, setLocalNav] = useState(true)
  const nav = navigationOpen ?? localNav
  const setNav = onNavigationChange ?? setLocalNav
  const [image, setImage] = useState(""),
    [history, setHistory] = useState<string[]>([]),
    [tool, setTool] = useState(initialTool)
  const [meta, setMeta] = useState<{ name: string; size: number; updatedAt: Date }>({ name: "vessel-image.png", size: 0, updatedAt: new Date() })
  const [size, setSize] = useState({ width: 1, height: 1 }),
    [resize, setResize] = useState({ width: 1, height: 1 })
  const [region, setRegion] = useState<ImageRegion>({ x: 0, y: 0, width: 1, height: 1 }),
    [regionOCR, setRegionOCR] = useState(false)
  const [mattingProgress, setMattingProgress] = useState("")
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState(""),
    [elapsed, setElapsed] = useState(0)
  const [photoSize, setPhotoSize] = useState("")
  const [standardPhotoOutput, setStandardPhotoOutput] = useState(false)
  const [cropRatio, setCropRatio] = useState<number | null>(null)
  const [backgroundColor, setBackgroundColor] = useState("#438edb")
  const [portraitFeather, setPortraitFeather] = useState(6)
  const [shadowCleanup, setShadowCleanup] = useState(50)
  const [portraitDecontaminate, setPortraitDecontaminate] = useState(true)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const panDrag = useRef<{ x: number; y: number; origin: typeof pan } | null>(null)
  const [zoom, setZoom] = useState(1),
    [settings, setSettings] = useState(true)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null),
    [bounds, setBounds] = useState({ width: 600, height: 600 })
  const [locked, setLocked] = useState(true),
    [quality, setQuality] = useState(85),
    [format, setFormat] = useState("image/png")
  const [angle, setAngle] = useState(90),
    [strength, setStrength] = useState(50),
    [watermark, setWatermark] = useState("Vessel")
  const [fontSize, setFontSize] = useState(32),
    [opacity, setOpacity] = useState(65),
    [ink, setInk] = useState("#ffffff"),
    [colors, setColors] = useState<string[]>([])
  const [layer, setLayer] = useState(""),
    [layerX, setLayerX] = useState(0),
    [layerY, setLayerY] = useState(0),
    [layerWidth, setLayerWidth] = useState(200)
  const [blend, setBlend] = useState<GlobalCompositeOperation>("source-over")
  const fileInput = useRef<HTMLInputElement>(null),
    layerInput = useRef<HTMLInputElement>(null),
    root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ mode: string; start: { x: number; y: number }; origin: ImageRegion } | null>(null)
  const [shapes, setShapes] = useState<Shape[]>([]),
    [draft, setDraft] = useState<Shape | null>(null),
    [pen, setPen] = useState<(typeof annotateTools)[number]["id"]>("pen")
  const [penColor, setPenColor] = useState("#ef4444"),
    [penWidth, setPenWidth] = useState(4),
    [note, setNote] = useState("文字"),
    [noteSize, setNoteSize] = useState(32)
  useEffect(() => {
    if (!viewport) return
    // 滚轮缩放图片（需要非 passive 监听才能阻止滚动）

    /** Performs the wheel operation. */
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(4, Math.max(0.25, +(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)).toFixed(3))))
    }
    viewport.addEventListener("wheel", wheel, { passive: false })
    return () => viewport.removeEventListener("wheel", wheel)
  }, [viewport])
  useEffect(() => {
    setShapes([])
    setDraft(null)
  }, [tool])
  useEffect(() => {
    if (!viewport) return
    const observer = new ResizeObserver(([entry]) => setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [viewport])
  const fit = Math.min(1, Math.max(1, bounds.width - 48) / size.width, Math.max(1, bounds.height - 48) / size.height)
  const scale = fit * zoom,
    selection = !!image && (tool === "crop" || (tool === "ocr" && regionOCR))
  const active = allTools.find((t) => t.id === tool)!,
    Icon = active.icon


  return { originalImage, backgroundEdit, localNav, setLocalNav, nav, setNav, image, setImage, history, setHistory, tool, setTool, meta, setMeta, size, setSize, resize, setResize, region, setRegion, regionOCR, setRegionOCR, mattingProgress, setMattingProgress, busy, setBusy, result, setResult, elapsed, setElapsed, photoSize, setPhotoSize, standardPhotoOutput, setStandardPhotoOutput, cropRatio, setCropRatio, backgroundColor, setBackgroundColor, portraitFeather, setPortraitFeather, shadowCleanup, setShadowCleanup, portraitDecontaminate, setPortraitDecontaminate, pan, setPan, panDrag, zoom, setZoom, settings, setSettings, viewport, setViewport, bounds, setBounds, locked, setLocked, quality, setQuality, format, setFormat, angle, setAngle, strength, setStrength, watermark, setWatermark, fontSize, setFontSize, opacity, setOpacity, ink, setInk, colors, setColors, layer, setLayer, layerX, setLayerX, layerY, setLayerY, layerWidth, setLayerWidth, blend, setBlend, fileInput, layerInput, root, drag, shapes, setShapes, draft, setDraft, pen, setPen, penColor, setPenColor, penWidth, setPenWidth, note, setNote, noteSize, setNoteSize, fit, scale, selection, active, Icon }
}

export type ImageToolboxState = ReturnType<typeof useImageToolboxState>
