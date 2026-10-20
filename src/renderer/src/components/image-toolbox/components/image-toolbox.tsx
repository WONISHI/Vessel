import { StatusBar } from "@/components/ui/status-bar"
import { Action } from "@/components/image-toolbox/components/action"
import { Shape, allTools, annotateTools, copy, drawShape, formatBytes, groups } from "@/components/image-toolbox/components/image-toolbox-shared"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { RangeField } from "@/components/image-toolbox/components/range-field"
import { ShapeSvg } from "@/components/image-toolbox/components/shape-svg"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { recognizeImage } from "@/lib/image/image-ocr"
import { canvasFor, clampRegion, cropImage, downloadImage, downloadText, imageCanvas, loadImage, type ImageRegion } from "@vessel/utils/image/operations"
import { fitCrop, photoSizes } from "@vessel/utils/image/photo"
import { Clipboard, Copy, Download, Expand, ImageIcon, LoaderCircle, Maximize, PanelLeft, PanelRight, RotateCcw, Sparkles, Trash2, Undo2, Upload, ZoomIn, ZoomOut } from "lucide-react"
import { useEffect, useRef, useState, type PointerEvent } from "react"
import { toast } from "sonner"

/** Renders the image toolbox component. */
export function ImageToolbox({ initialImage, initialTool = "ocr", embedded = false, navigationOpen, onNavigationChange }: { initialImage?: string; initialTool?: string; embedded?: boolean; navigationOpen?: boolean; onNavigationChange?: (open: boolean) => void } = {}) {
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
    if (initialImage) {
      setMeta({ name: "当前图片.png", size: Math.round((initialImage.length * 3) / 4), updatedAt: new Date() })
      void run(() => accept(initialImage, true))
    }
  }, [initialImage])
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
  return (
    <div
      className={"image-toolbox" + (embedded ? " embedded" : "")}
      ref={root}
      aria-busy={busy}
    >
      <header className="image-header">
        <span className="image-brand">
          <ImageIcon />
        </span>
        <div>
          <h1>图片工具箱</h1>
          <p>缩放 · 裁剪 · 旋转 · 压缩 · 转换 · 水印 · 取色 · 锐化 · 合成 · OCR</p>
        </div>
        <div className="image-header-actions">
          <button
            className="image-button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            导入图片
          </button>
          <button
            className="image-button"
            disabled={busy}
            onClick={paste}
          >
            <Clipboard />
            剪贴板
          </button>
          <button
            className="image-button"
            disabled={disabled}
            onClick={clearImage}
          >
            <Trash2 />
            清空
          </button>
          <button
            className="image-button"
            disabled={disabled}
            onClick={resetImage}
          >
            <RotateCcw />
            重置
          </button>
          <button
            className="image-button"
            disabled={busy || (!history.length && !shapes.length && !draft)}
            onClick={undo}
          >
            <Undo2 />
            撤回
          </button>
          <Action
            disabled={disabled}
            onClick={exportCurrent}
          >
            <Download />
            导出
          </Action>
        </div>
      </header>
      {[false, true].map((isLayer) => (
        <input
          key={String(isLayer)}
          ref={isLayer ? layerInput : fileInput}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={isLayer ? "添加合成图片" : "导入图片文件"}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void run(() => readFile(file, isLayer))
          }}
        />
      ))}
      <div className="image-body">
        {nav && (
          <ScrollArea className="image-tool-nav">
            <nav aria-label="图片操作">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3>{group.label}</h3>
                  {group.tools.map(({ id, title, icon: ToolIcon }) => (
                    <button
                      key={id}
                      aria-pressed={tool === id}
                      onClick={() => setTool(id)}
                    >
                      <ToolIcon />
                      {title}
                    </button>
                  ))}
                </section>
              ))}
            </nav>
          </ScrollArea>
        )}
        <section className="image-preview-area">
          <div className="image-preview-toolbar">
            <button
              aria-label="缩小图片"
              disabled={!image || zoom <= 0.25}
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            >
              <ZoomOut />
            </button>
            <output>{Math.round(scale * 100)}%</output>
            <button
              aria-label="放大图片"
              disabled={!image || zoom >= 4}
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              <ZoomIn />
            </button>
            <button
              aria-label="图片适应画布"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
            >
              <Expand />
            </button>
            <button
              aria-label="撤销图片编辑"
              disabled={busy || (!history.length && !shapes.length && !draft)}
              onClick={undo}
            >
              <Undo2 />
            </button>
            <span className="image-toolbar-spacer" />
            <button
              aria-label="切换图片工具栏"
              aria-pressed={nav}
              onClick={() => setNav(!nav)}
            >
              <PanelLeft />
            </button>
            <button
              aria-label="切换图片设置面板"
              aria-pressed={settings}
              onClick={() => setSettings((v) => !v)}
            >
              <PanelRight />
            </button>
            <button
              aria-label="全屏预览"
              onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch((e) => toast.error(String(e)))}
            >
              <Maximize />
            </button>
          </div>
          <div
            ref={setViewport}
            className="image-viewport"
            onPointerDown={(event) => {
              if (!image || (event.target instanceof Element && event.target.closest(".image-picture") && (selection || annotating))) return
              event.currentTarget.setPointerCapture(event.pointerId)
              panDrag.current = { x: event.clientX, y: event.clientY, origin: pan }
            }}
            onPointerMove={(event) => {
              const drag = panDrag.current
              if (drag) setPan({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y })
            }}
            onPointerUp={() => {
              panDrag.current = null
            }}
            onPointerCancel={() => {
              panDrag.current = null
            }}
          >
            <div
              className="image-stage"
              style={{ width: "100%", height: "100%", transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              {image ? (
                <div
                  className={"image-picture" + (selection ? " selecting" : "") + (annotating ? " annotating" : "")}
                  style={{ width: size.width * scale, height: size.height * scale }}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={cancel}
                >
                  <img
                    src={image}
                    alt="待处理图片"
                    draggable={false}
                  />
                  {annotating && (
                    <svg
                      className="image-annotations"
                      viewBox={`0 0 ${size.width} ${size.height}`}
                    >
                      {[...shapes, ...(draft ? [draft] : [])].map((s, i) => (
                        <ShapeSvg
                          key={i}
                          s={s}
                        />
                      ))}
                    </svg>
                  )}
                  {selection && (
                    <div
                      className="image-crop"
                      data-handle="move"
                      style={{ left: region.x * scale, top: region.y * scale, width: region.width * scale, height: region.height * scale }}
                    >
                      {["nw", "ne", "sw", "se"].map((h) => (
                        <i
                          key={h}
                          data-handle={h}
                          className={"handle-" + h}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="image-empty"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImageIcon />
                  <strong>导入图片开始编辑</strong>
                  <span>PNG、JPEG、WebP · 本地处理</span>
                </button>
              )}
            </div>
            {busy && (
              <div
                className="image-processing"
                role="status"
              >
                <LoaderCircle className="animate-spin" />
                {mattingProgress || (tool === "ocr" ? "正在识别，请稍候…" : "正在处理图片…")}
              </div>
            )}
          </div>
        </section>
        {settings && (
          <aside className="image-settings">
            <div className="image-settings-heading">
              <span>
                <Icon />
              </span>
              <div>
                <h2>{active.title}</h2>
                <p>{tool === "ocr" ? "图片文字提取，本地离线识别" : "调整参数后应用到图片"}</p>
              </div>
            </div>
            <ScrollArea className="image-settings-scroll">
              <div className="image-settings-content">
                <fieldset disabled={busy}>
                  {tool === "ocr" && (
                    <>
                      <div className="image-control-row">
                        <span className="image-language">中文 + 英文</span>
                        <Action
                          disabled={disabled}
                          onClick={recognize}
                        >
                          <Sparkles />
                          开始识别
                        </Action>
                      </div>
                      <label className="image-switch">
                        框选区域识别
                        <Switch
                          checked={regionOCR}
                          onCheckedChange={setRegionOCR}
                        />
                      </label>
                      <div className="image-result-label">
                        识别结果
                        <div>
                          <button
                            aria-label="复制识别文字"
                            disabled={!result}
                            onClick={() => copy(result)}
                          >
                            <Copy />
                          </button>
                          <button
                            aria-label="下载识别文字"
                            disabled={!result}
                            onClick={() => downloadText(result, "ocr-result.txt")}
                          >
                            <Download />
                          </button>
                        </div>
                      </div>
                      <textarea
                        aria-label="识别结果"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        placeholder="点击开始识别，结果将显示在这里"
                        className="image-result"
                      />
                      <div className="image-result-stats">
                        {result ? result.split("\n").length : 0} 行 · {result.length} 字 <span>耗时 {elapsed.toFixed(1)}s</span> · 本地离线
                      </div>
                    </>
                  )}
                  {tool === "resize" && (
                    <>
                      <div className="image-control-row">
                        <NumberField
                          label="宽度 (px)"
                          min={1}
                          value={resize.width}
                          onChange={(v) => resizeField("width", v)}
                        />
                        <NumberField
                          label="高度 (px)"
                          min={1}
                          value={resize.height}
                          onChange={(v) => resizeField("height", v)}
                        />
                      </div>
                      <label className="image-switch">
                        锁定比例
                        <Switch
                          checked={locked}
                          onCheckedChange={setLocked}
                        />
                      </label>
                      <div className="image-presets">
                        {[25, 50, 75, 100, 200].map((v) => (
                          <button
                            key={v}
                            aria-pressed={resize.width === Math.round((size.width * v) / 100) && resize.height === Math.round((size.height * v) / 100)}
                            onClick={() => setResize({ width: Math.round((size.width * v) / 100), height: Math.round((size.height * v) / 100) })}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          apply(async () => {
                            const img = await loadImage(image),
                              canvas = canvasFor(resize.width, resize.height),
                              ctx = canvas.getContext("2d")!
                            ctx.imageSmoothingQuality = "high"
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                            return canvas
                          })
                        }
                      >
                        应用缩放
                      </Action>
                    </>
                  )}
                  {tool === "crop" && (
                    <>
                      <p className="image-hint">在图片上拖动框选，或输入裁剪范围。</p>
                      <div className="image-control-row">
                        <NumberField
                          label="X"
                          value={region.x}
                          onChange={(v) => cropField("x", v)}
                        />
                        <NumberField
                          label="Y"
                          value={region.y}
                          onChange={(v) => cropField("y", v)}
                        />
                      </div>
                      <div className="image-control-row">
                        <NumberField
                          label="宽度"
                          min={1}
                          value={region.width}
                          onChange={(v) => cropField("width", v)}
                        />
                        <NumberField
                          label="高度"
                          min={1}
                          value={region.height}
                          onChange={(v) => cropField("height", v)}
                        />
                      </div>
                      <div className="image-presets">
                        {[1, 4 / 3, 16 / 9, 9 / 16].map((ratio, i) => (
                          <button
                            key={ratio}
                            aria-pressed={!photoSize && Math.abs(region.width / region.height - ratio) < 0.02 && (region.width !== size.width || region.height !== size.height)}
                            onClick={() => {
                              setPhotoSize("")
                              setCropRatio(ratio)
                              const w = Math.min(size.width, size.height * ratio),
                                h = w / ratio
                              setRegion(clampRegion({ x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h }, size))
                            }}
                          >
                            {["1:1", "4:3", "16:9", "9:16"][i]}
                          </button>
                        ))}
                      </div>
                      <label className="image-field">
                        证件照尺寸
                        <select
                          aria-label="证件照尺寸"
                          value={photoSize}
                          onChange={(e) => {
                            const value = e.target.value
                            setPhotoSize(value)
                            const preset = photoSizes.find((p) => p.id === value)
                            const ratio = preset ? preset.pixels.width / preset.pixels.height : null
                            setCropRatio(ratio)
                            if (ratio) setRegion(fitCrop(size, ratio))
                          }}
                        >
                          <option value="">自由裁剪 / 自定义比例</option>
                          {photoSizes.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                            >
                              {p.label} · {p.width} × {p.height} mm
                            </option>
                          ))}
                        </select>
                      </label>
                      {photoSize && (
                        <>
                          <label className="image-switch">
                            按证件照像素输出
                            <Switch
                              aria-label="按证件照像素输出"
                              checked={standardPhotoOutput}
                              onCheckedChange={setStandardPhotoOutput}
                            />
                          </label>
                          <p className="image-hint">
                            默认保留裁剪区域原始像素，只按证件照比例裁剪。开启后输出 {photoSizes.find((p) => p.id === photoSize)!.pixels.width} × {photoSizes.find((p) => p.id === photoSize)!.pixels.height} px（按 300 PPI
                            换算）。拖动裁剪框调整位置，四角缩放保持比例。缩小会丢失细节，低分辨率原图放大不会增加细节。
                          </p>
                        </>
                      )}
                      <div className="image-control-row">
                        <button
                          className="image-button"
                          onClick={() => {
                            setPhotoSize("")
                            setCropRatio(null)
                            setRegion({ x: 0, y: 0, ...size })
                          }}
                        >
                          重置
                        </button>
                        <Action
                          disabled={disabled}
                          onClick={() => apply(() => cropImage(image, region, standardPhotoOutput ? photoSizes.find((p) => p.id === photoSize)?.pixels : undefined))}
                        >
                          应用裁剪
                        </Action>
                      </div>
                    </>
                  )}
                  {tool === "rotate" && (
                    <>
                      <div className="image-presets">
                        <button
                          disabled={disabled}
                          onClick={() => rotate(-90)}
                        >
                          左转 90°
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(90)}
                        >
                          右转 90°
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(0, "x")}
                        >
                          水平翻转
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(0, "y")}
                        >
                          垂直翻转
                        </button>
                      </div>
                      <NumberField
                        label="旋转角度"
                        min={-360}
                        max={360}
                        value={angle}
                        onChange={setAngle}
                      />
                      <Action
                        disabled={disabled}
                        onClick={() => rotate(angle)}
                      >
                        应用旋转
                      </Action>
                    </>
                  )}
                  {tool === "annotate" && (
                    <>
                      <p className="image-hint">选择工具后在图片上拖动绘制；文字工具点击图片放置。</p>
                      <div className="image-presets">
                        {annotateTools.map(({ id, title, icon: PenIcon }) => (
                          <button
                            key={id}
                            aria-pressed={pen === id}
                            onClick={() => setPen(id)}
                          >
                            <PenIcon />
                            {title}
                          </button>
                        ))}
                      </div>
                      <label className="image-field">
                        颜色
                        <input
                          type="color"
                          value={penColor}
                          onChange={(e) => setPenColor(e.target.value)}
                        />
                      </label>
                      <NumberField
                        label="线宽 (px)"
                        min={1}
                        max={100}
                        value={penWidth}
                        onChange={setPenWidth}
                      />
                      {pen === "text" && (
                        <>
                          <label className="image-field">
                            文字内容
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              maxLength={200}
                            />
                          </label>
                          <NumberField
                            label="字号 (px)"
                            min={8}
                            max={500}
                            value={noteSize}
                            onChange={setNoteSize}
                          />
                        </>
                      )}
                      <div className="image-control-row">
                        <button
                          className="image-button"
                          disabled={!shapes.length}
                          onClick={() => setShapes((list) => list.slice(0, -1))}
                        >
                          <Undo2 />
                          撤销一笔
                        </button>
                        <button
                          className="image-button"
                          disabled={!shapes.length}
                          onClick={() => setShapes([])}
                        >
                          <Trash2 />
                          清空
                        </button>
                      </div>
                      <Action
                        disabled={disabled || !shapes.length}
                        onClick={applyShapes}
                      >
                        应用标注
                      </Action>
                    </>
                  )}
                  {tool === "background" && (
                    <>
                      <label className="image-field">
                        目标背景色
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                        />
                      </label>
                      <div className="image-presets">
                        {[
                          ["白色", "#ffffff"],
                          ["蓝色", "#438edb"],
                          ["红色", "#d93025"]
                        ].map(([name, color]) => (
                          <button
                            key={color}
                            aria-pressed={backgroundColor === color}
                            onClick={() => setBackgroundColor(color)}
                          >
                            <span style={{ display: "inline-block", width: 12, height: 12, background: color, border: "1px solid #ddd", marginRight: 6 }} />
                            {name}
                          </button>
                        ))}
                      </div>
                      <RangeField
                        disabled={busy}
                        label="主体边缘羽化 (px)"
                        value={portraitFeather}
                        onChange={setPortraitFeather}
                        max={6}
                      />
                      <RangeField
                        disabled={busy}
                        label="边缘阴影清理"
                        value={shadowCleanup}
                        onChange={setShadowCleanup}
                      />
                      <label className="image-switch">
                        去除主体边缘残色
                        <Switch
                          disabled={busy}
                          aria-label="去除主体边缘残色"
                          checked={portraitDecontaminate}
                          onCheckedChange={setPortraitDecontaminate}
                        />
                      </label>
                      <p className="image-hint">自动识别图片主体并替换背景，全程离线。羽化默认 6 px；阴影清理可减轻轮廓外的灰红色残影，过高可能减少细发丝。重复应用会基于换底前的图片处理，避免边缘越改越模糊。</p>
                      <Action
                        disabled={disabled}
                        onClick={() => {
                          void run(async () => {
                            try {
                              setMattingProgress("正在处理背景…")
                              const { portraitBackground } = await import("@/lib/image/portrait-matting")
                              const source = backgroundEdit.current?.result === image ? backgroundEdit.current.source : image
                              const canvas = await portraitBackground(source, backgroundColor, setMattingProgress, { feather: portraitFeather, decontaminate: portraitDecontaminate, shadowCleanup })
                              const result = canvas.toDataURL("image/png")
                              await accept(result)
                              backgroundEdit.current = { source, result }
                            } finally {
                              setMattingProgress("")
                            }
                          })
                        }}
                      >
                        应用背景色
                      </Action>
                    </>
                  )}
                  {tool === "sharpen" && (
                    <>
                      <RangeField
                        disabled={busy}
                        label="锐化强度"
                        value={strength}
                        onChange={setStrength}
                      />
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              ctx = canvas.getContext("2d")!,
                              data = ctx.getImageData(0, 0, canvas.width, canvas.height),
                              original = new Uint8ClampedArray(data.data),
                              w = canvas.width,
                              h = canvas.height,
                              amount = strength / 100
                            for (let y = 1; y < h - 1; y++)
                              for (let x = 1; x < w - 1; x++)
                                for (let c = 0; c < 3; c++) {
                                  const i = (y * w + x) * 4 + c
                                  data.data[i] = original[i] + amount * (4 * original[i] - original[i - 4] - original[i + 4] - original[i - w * 4] - original[i + w * 4])
                                }
                            ctx.putImageData(data, 0, 0)
                            return canvas
                          })
                        }
                      >
                        应用锐化
                      </Action>
                    </>
                  )}
                  {(tool === "compress" || tool === "convert") && (
                    <>
                      <label className="image-field">
                        导出格式
                        <select
                          value={format}
                          onChange={(e) => setFormat(e.target.value)}
                        >
                          <option value="image/png">PNG（无损）</option>
                          <option value="image/jpeg">JPEG</option>
                          <option value="image/webp">WebP</option>
                        </select>
                      </label>
                      {format !== "image/png" && (
                        <RangeField
                          disabled={busy}
                          label="图片质量 (%)"
                          value={quality}
                          onChange={setQuality}
                        />
                      )}
                      <p className="image-hint">PNG 保留透明度；JPEG 使用白色背景。压缩大小由图片内容和质量决定。</p>
                      <Action
                        disabled={disabled}
                        onClick={exportCurrent}
                      >
                        <Download />
                        导出图片
                      </Action>
                    </>
                  )}
                  {tool === "watermark" && (
                    <>
                      <label className="image-field">
                        水印文字
                        <input
                          value={watermark}
                          onChange={(e) => setWatermark(e.target.value)}
                          maxLength={200}
                        />
                      </label>
                      <NumberField
                        label="字号 (px)"
                        min={1}
                        max={500}
                        value={fontSize}
                        onChange={setFontSize}
                      />
                      <RangeField
                        disabled={busy}
                        label="不透明度 (%)"
                        value={opacity}
                        onChange={setOpacity}
                      />
                      <label className="image-field">
                        文字颜色
                        <input
                          type="color"
                          value={ink}
                          onChange={(e) => setInk(e.target.value)}
                        />
                      </label>
                      <p className="image-hint">文字放置在图片右下角。</p>
                      <Action
                        disabled={disabled || !watermark}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              ctx = canvas.getContext("2d")!
                            ctx.globalAlpha = opacity / 100
                            ctx.fillStyle = ink
                            ctx.font = `${Math.max(1, Math.min(500, fontSize))}px sans-serif`
                            ctx.textAlign = "right"
                            ctx.textBaseline = "bottom"
                            ctx.fillText(watermark, canvas.width - Math.min(24, canvas.width * 0.05), canvas.height - Math.min(24, canvas.height * 0.05), canvas.width * 0.9)
                            return canvas
                          })
                        }
                      >
                        添加水印
                      </Action>
                    </>
                  )}
                  {tool === "color" && (
                    <>
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          void run(async () => {
                            const img = await loadImage(image),
                              canvas = canvasFor(128, 128),
                              ctx = canvas.getContext("2d")!
                            ctx.drawImage(img, 0, 0, 128, 128)
                            const { data } = ctx.getImageData(0, 0, 128, 128),
                              counts = new Map<string, number>()
                            for (let i = 0; i < data.length; i += 4) {
                              if (data[i + 3] < 128) continue
                              const hex =
                                "#" +
                                [data[i], data[i + 1], data[i + 2]]
                                  .map((v) =>
                                    Math.min(255, Math.round(v / 32) * 32)
                                      .toString(16)
                                      .padStart(2, "0")
                                  )
                                  .join("")
                              counts.set(hex, (counts.get(hex) || 0) + 1)
                            }
                            setColors(
                              [...counts]
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 6)
                                .map(([hex]) => hex)
                            )
                          })
                        }
                      >
                        提取主色调
                      </Action>
                      <div className="image-swatches">
                        {colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => copy(color)}
                          >
                            <span style={{ background: color }} />
                            {color}
                          </button>
                        ))}
                      </div>
                      {!!colors.length && (
                        <button
                          className="image-button"
                          onClick={() => copy(colors.map((c, i) => `--image-color-${i + 1}: ${c};`).join("\n"))}
                        >
                          <Copy />
                          复制 CSS 变量
                        </button>
                      )}
                    </>
                  )}
                  {tool === "composite" && (
                    <>
                      <button
                        className="image-button"
                        disabled={disabled}
                        onClick={() => layerInput.current?.click()}
                      >
                        <Upload />
                        添加图片图层
                      </button>
                      {layer && (
                        <img
                          src={layer}
                          alt="待合成图层"
                          className="image-layer-thumbnail"
                        />
                      )}
                      <div className="image-control-row">
                        <NumberField
                          label="X"
                          min={-8192}
                          value={layerX}
                          onChange={setLayerX}
                        />
                        <NumberField
                          label="Y"
                          min={-8192}
                          value={layerY}
                          onChange={setLayerY}
                        />
                      </div>
                      <NumberField
                        label="图层宽度 (px)"
                        min={1}
                        value={layerWidth}
                        onChange={setLayerWidth}
                      />
                      <RangeField
                        disabled={busy}
                        label="不透明度 (%)"
                        value={opacity}
                        onChange={setOpacity}
                      />
                      <label className="image-field">
                        混合模式
                        <select
                          value={blend}
                          onChange={(e) => setBlend(e.target.value as GlobalCompositeOperation)}
                        >
                          <option value="source-over">正常</option>
                          <option value="multiply">正片叠底</option>
                          <option value="screen">滤色</option>
                          <option value="overlay">叠加</option>
                        </select>
                      </label>
                      <Action
                        disabled={disabled || !layer}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              img = await loadImage(layer),
                              ctx = canvas.getContext("2d")!
                            if (layerWidth < 1 || layerWidth > 8192) throw new Error("图层宽度须在 1–8192 像素内")
                            ctx.globalAlpha = opacity / 100
                            ctx.globalCompositeOperation = blend
                            ctx.drawImage(img, layerX, layerY, layerWidth, (layerWidth * img.naturalHeight) / img.naturalWidth)
                            return canvas
                          })
                        }
                      >
                        合并图层
                      </Action>
                    </>
                  )}
                </fieldset>
              </div>
            </ScrollArea>
            {tool === "ocr" && (
              <footer className="image-settings-footer">
                <button
                  className="image-button"
                  disabled={busy || !result}
                  onClick={() => {
                    setResult("")
                    setElapsed(0)
                  }}
                >
                  清空
                </button>
                <Action
                  disabled={!result}
                  onClick={() => copy(result)}
                >
                  复制全部
                </Action>
              </footer>
            )}
          </aside>
        )}
      </div>
      <StatusBar
        className="image-toolbox-statusbar"
        left={
          image ? (
            <>
              <span
                className="image-status-item image-status-filename"
                data-title={meta.name}
              >
                <ImageIcon />
                <span>{meta.name}</span>
              </span>
              <span
                className="image-status-divider"
                aria-hidden="true"
              />
              <span className="image-status-item">
                <Expand />
                {size.width} × {size.height} px
              </span>
              <span className="image-status-item">
                <ZoomIn />
                {Math.round(scale * 100)}%
              </span>
              <span className="image-status-item">
                <Upload />
                {formatBytes(meta.size)}
              </span>
              {selection && (
                <span className="image-status-item image-status-selection">
                  框选: {region.width} × {region.height} px
                </span>
              )}
            </>
          ) : (
            <span className="image-status-item">
              <ImageIcon />
              未导入图片
            </span>
          )
        }
      />
    </div>
  )
}
