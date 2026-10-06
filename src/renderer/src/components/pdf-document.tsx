import { useEffect, useMemo, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

pdfjs.GlobalWorkerOptions.workerSrc = workerURL
// 悬停 / 按下时背景变绿，文字与图标统一为白色。
const pdfButton = "hover:!bg-green-700 active:!bg-green-800 hover:!text-white active:!text-white disabled:hover:!bg-transparent disabled:hover:!text-inherit"

/** 基于 react-pdf 的 PDF 预览（工作区与 Office 页面共用，不依赖工作区上下文）。 */
export function PdfDocument({ bytes, name }: { bytes: Uint8Array; name: string }) {
  const file = useMemo(() => ({ data: new Uint8Array(bytes) }), [bytes])
  const host = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [pages, setPages] = useState(0)
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  useEffect(() => {
    const observer = new ResizeObserver((entries) => setWidth(Math.max(100, entries[0].contentRect.width - 32)))
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={host}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col"
      aria-label={name}
    >
      <div className="flex shrink-0 items-center justify-center gap-2 border-b p-2">
        <Button variant="ghost" size="sm" className={pdfButton} disabled={page <= 1} onClick={() => setPage(page - 1)}>
          <ChevronLeft className="size-4" />
          上一页
        </Button>
        <span className="text-sm">
          {page} / {pages || "…"}
        </span>
        <Button variant="ghost" size="sm" className={pdfButton} disabled={page >= pages} onClick={() => setPage(page + 1)}>
          下一页
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className={cn(pdfButton, "size-8")} aria-label="缩小" disabled={zoom <= 0.5} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}>
          <Minus className="size-4" />
        </Button>
        <span className="min-w-10 text-center text-sm">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon" className={cn(pdfButton, "size-8")} aria-label="放大" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + 0.25))}>
          <Plus className="size-4" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => {
            setPages(numPages)
            setPage(1)
          }}
          loading="正在加载 PDF…"
          error="PDF 加载失败，请检查文件是否完整或已加密。"
          className="p-4"
        >
          <Page
            pageNumber={page}
            width={width * zoom}
            loading="正在渲染…"
          />
        </Document>
      </ScrollArea>
    </div>
  )
}
