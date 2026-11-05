import { usePdfViewState } from "@/components/pdf-document/components/view-state"
import "@/components/pdf-document/components/pdf-document.css"
import { LazyPage } from "@/components/pdf-document/components/lazy-page"
import { COLORS, Stroke, notifyError, readInkStrokes, writeInkStrokes } from "@/components/pdf-document/components/pdf-document-shared"
import { PdfOutline } from "@/components/pdf-document/components/pdf-outline"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Check, CheckSquare, ChevronDown, Download, Eraser, FileText, Minus, MousePointer2, Pencil, Plus, Undo2 } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import { useEffect, useMemo, useRef, useState } from "react"
import { Document } from "react-pdf"

/** Renders the pdf document component. */
export function PdfDocument({ bytes, name, viewStateKey = name }: { bytes: Uint8Array; name: string; viewStateKey?: string }) {
  const file = useMemo(() => ({ data: new Uint8Array(bytes) }), [bytes])
  const [width, setWidth] = useState(600)
  const [document, setDocument] = useState<PDFDocumentProxy>(),
    [tool, setTool] = useState("view")
  const { viewport, zoom, setZoom } = usePdfViewState(viewStateKey, !!document, width)
  const [color, setColor] = useState("#e11d48"),
    [penWidth, setPenWidth] = useState(3)
  const [strokes, setStrokes] = useState<Stroke[]>([]),
    [loaded, setLoaded] = useState(false),
    [saving, setSaving] = useState(false)
  const undo = useRef<Stroke[][]>([]),
    persistence = useRef(Promise.resolve())
  const key = document ? `pdf-ink:${document.fingerprints[0]}` : ""
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(100, entry.contentRect.width - 16)))
    if (viewport.current) observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [viewport])
  useEffect(() => {
    setLoaded(false)
    setStrokes([])
    undo.current = []
    if (!key) return
    let active = true
    void readInkStrokes(key)
      .then((value) => {
        if (active) {
          setStrokes(value)
          setLoaded(true)
        }
      })
      .catch((error) => notifyError(`标注读取失败：${error}`))
    return () => {
      active = false
    }
  }, [key])

  /** Performs the change operation. */
  const change = (next: Stroke[], remember = true) => {
    if (remember) undo.current.push(strokes)
    setStrokes(next)
    persistence.current = persistence.current
      .catch(() => {})
      .then(() => writeInkStrokes(key, next))
      .catch((error) => {
        notifyError(`标注保存失败：${error}`)
      })
  }

  /** Performs the export pdf operation. */
  const exportPDF = async () => {
    if (!document) return
    setSaving(true)
    const ids: string[] = []
    try {
      for (const stroke of strokes) {
        const page = await document.getPage(stroke.page),
          viewport = page.getViewport({ scale: 1 })
        const points = stroke.points.map(([x, y]) => viewport.convertToPdfPoint(x * viewport.width, y * viewport.height))
        const id = `pdfjs_internal_editor_${stroke.id}`
        ids.push(id)
        document.annotationStorage.setValue(id, {
          annotationType: 15,
          pageIndex: stroke.page - 1,
          color: [1, 3, 5].map((i) => parseInt(stroke.color.slice(i, i + 2), 16)),
          thickness: stroke.width * viewport.width,
          opacity: 1,
          rotation: 0,
          rect: page.view,
          paths: { points: [points.flat()], lines: [points.flatMap(([x, y]) => [NaN, NaN, NaN, NaN, x, y])] }
        })
      }
      const data = await document.saveDocument()
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: "application/pdf" }))
      const link = window.document.createElement("a")
      link.href = url
      link.download = name.replace(/\.pdf$/i, "") + "-标注.pdf"
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (error) {
      notifyError(`PDF 导出失败：${error}`)
    } finally {
      ids.forEach((id) => document.annotationStorage.remove(id))
      setSaving(false)
    }
  }
  return (
    <div
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      aria-label={name}
    >
      <ScrollArea className="pdf-annotation-toolbar shrink-0 border-b bg-white">
        <div className="pdf-toolbar-row flex h-14 w-max min-w-full items-center gap-1.5 whitespace-nowrap px-3.5">
          {[
            ["view", MousePointer2, "浏览"],
            ["pen", Pencil, "画笔"],
            ["erase", Eraser, "擦除笔迹"]
          ].map(([value, Icon, label]) => {
            const ToolIcon = Icon as typeof Pencil
            return (
              <button
                key={String(value)}
                disabled={!loaded}
                aria-label={String(label)}
                aria-pressed={tool === value}
                className="pdf-tool"
                onClick={() => setTool(String(value))}
              >
                <ToolIcon className="size-4" />
                <span className="pdf-tool-label">{String(label)}</span>
              </button>
            )
          })}
          <span className="pdf-toolbar-divider mx-[7px] h-6 w-px shrink-0 bg-stone-200" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="笔迹颜色"
                className="pdf-control w-[42px] justify-center"
              >
                <span
                  className="size-[22px] rounded-[7px] ring-1 ring-black/10"
                  style={{ background: color }}
                />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="pdf-annotation-popover w-64 p-3"
            >
              <p className="mb-2 text-xs font-medium text-stone-500">笔迹颜色</p>
              <div className="grid grid-cols-6 gap-2">
                {COLORS.map((value) => (
                  <button
                    key={value}
                    aria-label={value}
                    onClick={() => setColor(value)}
                    className="flex size-8 items-center justify-center rounded-md ring-1 ring-black/5 hover:scale-105"
                    style={{ background: value }}
                  >
                    {color.toLowerCase() === value && <span className={`size-2 rounded-full ${value === "#ffffff" ? "bg-stone-700" : "bg-white"}`} />}
                  </button>
                ))}
              </div>
              <div className="my-3 h-px bg-stone-100" />
              <label className="flex cursor-pointer items-center justify-between text-sm text-stone-700">
                自定义颜色
                <span
                  className="relative size-7 overflow-hidden rounded-md ring-1 ring-black/10"
                  style={{ background: color }}
                >
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </span>
              </label>
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="笔迹粗细"
                className="pdf-control gap-2 px-2.5 font-semibold"
              >
                <span
                  className="pdf-pen-preview w-4 rounded-full bg-stone-700"
                  style={{ height: Math.min(penWidth, 4) }}
                />
                <span className="pdf-tool-label">{penWidth}px</span>
                <ChevronDown className="size-3.5 text-stone-400" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="pdf-annotation-popover w-48 p-2"
            >
              <p className="mb-1 px-2 text-xs font-medium text-stone-500">笔迹粗细</p>
              {[1, 2, 3, 5, 8].map((size) => (
                <button
                  key={size}
                  onClick={() => setPenWidth(size)}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm ${penWidth === size ? "bg-green-50 text-green-700" : "text-stone-700 hover:bg-stone-100"}`}
                >
                  <span
                    className={`pdf-pen-preview w-16 rounded-full ${penWidth === size ? "bg-green-600" : "bg-stone-700"}`}
                    style={{ height: size }}
                  />
                  <span className="flex-1 text-left">{size}px</span>
                  {penWidth === size && <Check className="size-4" />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <span className="pdf-toolbar-divider mx-[7px] h-6 w-px shrink-0 bg-stone-200" />
          <button
            aria-label="撤销"
            disabled={!undo.current.length}
            onClick={() => change(undo.current.pop()!, false)}
            className="pdf-tool"
          >
            <Undo2 className="size-[17px]" />
            <span className="pdf-tool-label">撤销</span>
          </button>
          <div className="flex flex-1 items-center justify-center gap-2.5 px-2 text-xs text-stone-400">
            <span className="flex items-center gap-1.5"><FileText className="size-[15px]" /><span className="pdf-tool-label">共 {document?.numPages || "…"} 页</span></span>
            <span className="pdf-save-chip flex h-7 items-center gap-1.5 rounded-lg px-[11px] font-semibold">
              <CheckSquare className="size-3.5" />
              {loaded ? "自动保存" : "正在读取标注…"}
            </span>
          </div>
          <div className="pdf-zoom-group">
            <button type="button" aria-label="缩小" disabled={zoom <= 0.5} onClick={() => setZoom((value) => value - 0.25)}>
              <Minus className="size-4" />
            </button>
            <button type="button" className="pdf-zoom-value" aria-label="恢复 100% 缩放" onClick={() => setZoom(1)}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" aria-label="放大" disabled={zoom >= 3} onClick={() => setZoom((value) => value + 0.25)}>
              <Plus className="size-4" />
            </button>
          </div>
          <span className="pdf-toolbar-divider mx-[7px] h-6 w-px shrink-0 bg-stone-200" />
          <button
            type="button"
            className="pdf-export ml-1 flex h-10 shrink-0 items-center gap-2 rounded-[10px] bg-green-600 px-[18px] text-[13.5px] font-semibold text-white hover:bg-green-700 disabled:opacity-40"
            aria-label="导出标注 PDF"
            disabled={!loaded || saving}
            onClick={() => void exportPDF()}
          >
            <Download className="size-[17px]" />
            <span className="pdf-export-label">导出标注 PDF</span>
          </button>
        </div>
        <ScrollBar
          orientation="horizontal"
          className="h-1.5"
        />
      </ScrollArea>
      <div className="flex min-h-0 flex-1">
        <ScrollArea viewportRef={viewport} className="min-h-0 min-w-0 flex-1 bg-stone-100 dark:bg-[#1a1d21] [&_[data-radix-scroll-area-viewport]]:p-4">
          <div data-pdf-scroll>
            <Document
              file={file}
              onLoadSuccess={setDocument}
              loading="正在加载 PDF…"
              error="PDF 加载失败，请检查文件是否完整或已加密。"
            >
              {Array.from({ length: document?.numPages || 0 }, (_, index) => (
                <LazyPage
                  key={`${key}:${index}`}
                  number={index + 1}
                  width={width * zoom}
                  strokes={strokes.filter((stroke) => stroke.page === index + 1)}
                  tool={loaded ? tool : "view"}
                  color={color}
                  penWidth={penWidth}
                  add={(stroke) => change([...strokes, stroke])}
                  erase={(id) => change(strokes.filter((stroke) => stroke.id !== id))}
                />
              ))}
            </Document>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        {document && <PdfOutline key={key} pdf={document} name={name} viewport={viewport} />}
      </div>
    </div>
  )
}
