import { drawShape } from "@/components/image-toolbox/components/image-toolbox-shared"
import { recognizeImage } from "@/lib/image/image-ocr"
import { canvasFor, clampRegion, cropImage, downloadImage, imageCanvas, loadImage, type ImageRegion } from "@vessel/utils/image/operations"
import { fitCrop } from "@vessel/utils/image/photo"
import { useEffect, type PointerEvent } from "react"
import { toast } from "sonner"
import type { ImageToolboxState } from "@/components/image-toolbox/hooks/use-image-toolbox-state"
import type { ImageToolboxProps } from "@/components/image-toolbox/types"

/** 图片工具箱的图片处理、指针交互与导入导出操作 */
export function useImageToolboxActions(state: ImageToolboxState, { initialImage }: ImageToolboxProps) {
  const { originalImage, backgroundEdit, image, setImage, history, setHistory, tool, setMeta, size, setSize, setResize, region, setRegion, regionOCR, setRegionOCR, busy, setBusy, setResult, setElapsed, setPhotoSize, setStandardPhotoOutput, cropRatio, setCropRatio, setBackgroundColor, setPortraitFeather, setShadowCleanup, setPortraitDecontaminate, setPan, panDrag, setZoom, locked, setLocked, quality, setQuality, format, setFormat, setAngle, setStrength, setWatermark, setFontSize, setOpacity, setInk, setColors, setLayer, setLayerX, setLayerY, setLayerWidth, setBlend, drag, shapes, setShapes, draft, setDraft, pen, setPen, penColor, setPenColor, penWidth, setPenWidth, note, setNote, noteSize, setNoteSize, scale, selection } = state

  /** Runs run. */
  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  /** Performs the accept operation. */
  const accept = async (src: string, reset = false) => {
    setPan({ x: 0, y: 0 })
    setPhotoSize("")
    setStandardPhotoOutput(false)
    setCropRatio(null)
    const img = await loadImage(src),
      next = { width: img.naturalWidth, height: img.naturalHeight }
    if (reset) {
      originalImage.current = src
      backgroundEdit.current = null
    }
    setShapes([])
    setDraft(null)
    setHistory((previous) => (reset ? [] : [...previous.slice(-19), image].filter(Boolean)))
    setImage(src)
    setSize(next)
    setResize(next)
    setRegion({ x: 0, y: 0, ...next })
    setZoom(1)
    setResult("")
    setElapsed(0)
    setColors([])
    if (reset) {
      setLayer("")
      setFormat("image/png")
    } else {
      setMeta((m) => ({ ...m, size: Math.round((src.length * 3) / 4), updatedAt: new Date() }))
    }
  }

  /** Performs the undo operation. */
  const undo = () => {
    if (draft) {
      setDraft(null)
      return
    }
    if (shapes.length) {
      setShapes((list) => list.slice(0, -1))
      return
    }
    const previous = history.at(-1)
    if (!previous) return
    const remaining = history.slice(0, -1)
    void run(async () => {
      await accept(previous)
      setHistory(remaining)
    })
  }

  /** Resets options. */
  const resetOptions = () => {
    backgroundEdit.current = null
    setShapes([])
    setDraft(null)
    setLayer("")
    setResult("")
    setElapsed(0)
    setColors([])
    setPhotoSize("")
    setStandardPhotoOutput(false)
    setCropRatio(null)
    setBackgroundColor("#438edb")
    setPortraitFeather(6)
    setPortraitDecontaminate(true)
    setShadowCleanup(50)
    setLocked(true)
    setQuality(85)
    setFormat("image/png")
    setAngle(90)
    setStrength(50)
    setWatermark("Vessel")
    setFontSize(32)
    setOpacity(65)
    setInk("#ffffff")
    setLayerX(0)
    setLayerY(0)
    setLayerWidth(200)
    setBlend("source-over")
    setPen("pen")
    setPenColor("#ef4444")
    setPenWidth(4)
    setNote("文字")
    setNoteSize(32)
    setRegionOCR(false)
    setZoom(1)
    setPan({ x: 0, y: 0 })
    drag.current = null
    panDrag.current = null
  }

  /** Clears image. */
  const clearImage = () => {
    originalImage.current = ""
    setImage("")
    setHistory([])
    resetOptions()
    setSize({ width: 1, height: 1 })
    setResize({ width: 1, height: 1 })
    setRegion({ x: 0, y: 0, width: 1, height: 1 })
    setMeta({ name: "vessel-image.png", size: 0, updatedAt: new Date() })
  }

  /** Resets image. */
  const resetImage = () =>
    void run(async () => {
      if (!originalImage.current) return
      await accept(originalImage.current)
      resetOptions()
    })

  /** Applies apply. */
  const apply = (operation: () => Promise<HTMLCanvasElement>, mime = "image/png") =>
    void run(async () => {
      const canvas = await operation()
      await accept(canvas.toDataURL(mime, quality / 100))
    })

  /** Reads file. */
  const readFile = async (file: File, isLayer: boolean) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 30_000_000) throw new Error("请选择 30 MB 以内的 PNG、JPEG 或 WebP 图片")
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error("读取图片失败"))
      reader.readAsDataURL(file)
    })
    if (isLayer) {
      const img = await loadImage(src)
      setLayer(src)
      setLayerWidth(Math.min(size.width, img.naturalWidth))
    } else {
      setMeta({ name: file.name, size: file.size, updatedAt: new Date(file.lastModified || Date.now()) })
      await accept(src, true)
    }
  }

  /** Pastes paste. */
  const paste = () =>
    void run(async () => {
      const src = await window.electronAPI.readClipboardImage()
      if (!src) throw new Error("剪贴板中没有图片")
      setMeta({ name: "剪贴板图片.png", size: Math.round((src.length * 3) / 4), updatedAt: new Date() })
      await accept(src, true)
    })

  /** Performs the export current operation. */
  const exportCurrent = () =>
    void run(async () => {
      const canvas = await imageCanvas(image)
      if (format === "image/jpeg") {
        const ctx = canvas.getContext("2d")!
        ctx.globalCompositeOperation = "destination-over"
        ctx.fillStyle = "#fff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }
      downloadImage(canvas.toDataURL(format, quality / 100), `vessel-image.${format.split("/")[1]}`)
    })

  /** Rotates rotate. */
  const rotate = (degrees: number, flip?: "x" | "y") =>
    apply(async () => {
      const img = await loadImage(image),
        radians = (degrees * Math.PI) / 180
      const w = img.naturalWidth,
        h = img.naturalHeight
      const canvas = canvasFor(Math.ceil(Math.abs(w * Math.cos(radians)) + Math.abs(h * Math.sin(radians)) - 1e-8), Math.ceil(Math.abs(w * Math.sin(radians)) + Math.abs(h * Math.cos(radians)) - 1e-8))
      const ctx = canvas.getContext("2d")!
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(radians)
      ctx.scale(flip === "x" ? -1 : 1, flip === "y" ? -1 : 1)
      ctx.drawImage(img, -w / 2, -h / 2)
      return canvas
    })

  /** Performs the point operation. */
  const point = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(size.width, (e.clientX - box.left) / scale)), y: Math.max(0, Math.min(size.height, (e.clientY - box.top) / scale)) }
  }
  const annotating = tool === "annotate"

  /** Moves move. */
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (annotating) {
      if (!draft) return
      const p = point(e)
      setDraft((d) => d && (d.kind === "pen" ? { ...d, points: [...d.points, p] } : { ...d, points: [d.points[0], p] }))
      return
    }
    const d = drag.current
    if (!d) return
    const p = point(e),
      o = d.origin
    if (d.mode === "move") {
      setRegion({ ...o, x: Math.round(Math.max(0, Math.min(size.width - o.width, o.x + p.x - d.start.x))), y: Math.round(Math.max(0, Math.min(size.height - o.height, o.y + p.y - d.start.y))) })
      return
    }
    // 新建框选以按下点为锚点；四角缩放以对角为锚点
    const ax = d.mode === "new" ? d.start.x : d.mode.includes("w") ? o.x + o.width : o.x,
      ay = d.mode === "new" ? d.start.y : d.mode.includes("n") ? o.y + o.height : o.y
    if (tool === "crop" && cropRatio) {
      const next = fitCrop(size, cropRatio, { x: ax, y: ay }, p)
      if (next.width > 0 && next.height > 0) setRegion(next)
      return
    }
    setRegion(clampRegion({ x: Math.min(ax, p.x), y: Math.min(ay, p.y), width: Math.abs(p.x - ax), height: Math.abs(p.y - ay) }, size))
  }

  /** Performs the down operation. */
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (busy) return
    if (annotating) {
      e.currentTarget.setPointerCapture(e.pointerId)
      const p = point(e)
      if (pen === "text") {
        if (note) setShapes((list) => [...list, { kind: "text", color: penColor, width: penWidth, points: [p], text: note, size: noteSize }])
        return
      }
      setDraft({ kind: pen, color: penColor, width: penWidth, points: [p] })
      return
    }
    if (!selection) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const handle = (e.target as HTMLElement).dataset.handle,
      p = point(e)
    drag.current = { mode: handle || "new", start: p, origin: region }
    if (!handle) move(e)
  }

  /** Performs the up operation. */
  const up = (e: PointerEvent<HTMLDivElement>) => {
    if (annotating) {
      if (draft && draft.points.length > 1) setShapes((list) => [...list, draft])
      setDraft(null)
      return
    }
    move(e)
    drag.current = null
  }

  /** Cancels cancel. */
  const cancel = () => {
    drag.current = null
    setDraft(null)
  }

  /** Applies shapes. */
  const applyShapes = () => {
    const list = shapes
    setShapes([])
    apply(async () => {
      const canvas = await imageCanvas(image),
        ctx = canvas.getContext("2d")!
      list.forEach((s) => drawShape(ctx, s))
      return canvas
    })
  }

  /** Performs the recognize operation. */
  const recognize = () =>
    void run(async () => {
      const started = performance.now()
      const src = regionOCR ? (await cropImage(image, region)).toDataURL() : (await imageCanvas(image)).toDataURL()
      const text = await recognizeImage(src)
      setResult(text)
      setElapsed((performance.now() - started) / 1000)
      if (!text) toast.info("未识别到文字")
    })

  /** Resizes field. */
  const resizeField = (axis: "width" | "height", value: number) => setResize((current) => ({ ...current, [axis]: value, ...(locked ? (axis === "width" ? { height: Math.round((value * size.height) / size.width) } : { width: Math.round((value * size.width) / size.height) }) : {}) }))

  /** Crops field. */
  const cropField = (axis: keyof ImageRegion, value: number) => {
    if (cropRatio && (axis === "width" || axis === "height")) {
      const width = Math.min(axis === "width" ? Math.max(1, value) : Math.max(1, value) * cropRatio, size.width - region.x, (size.height - region.y) * cropRatio)
      setRegion({ ...region, width, height: width / cropRatio })
      return
    }
    setRegion((current) => (cropRatio ? { ...current, [axis]: Math.max(0, Math.min(value, axis === "x" ? size.width - current.width : size.height - current.height)) } : clampRegion({ ...current, [axis]: value }, size)))
  }
  const disabled = !image || busy

  useEffect(() => {
    if (initialImage) {
      setMeta({ name: "当前图片.png", size: Math.round((initialImage.length * 3) / 4), updatedAt: new Date() })
      void run(() => accept(initialImage, true))
    }
  }, [initialImage])

  return { run, accept, undo, resetOptions, clearImage, resetImage, apply, readFile, paste, exportCurrent, rotate, point, annotating, move, down, up, cancel, applyShapes, recognize, resizeField, cropField, disabled }
}
