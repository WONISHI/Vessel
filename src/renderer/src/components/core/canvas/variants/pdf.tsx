import { useEffect, useMemo, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

pdfjs.GlobalWorkerOptions.workerSrc = workerURL
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
        <Button
          variant="ghost"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          上一页
        </Button>
        <span className="text-sm">
          {page} / {pages || "…"}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
        >
          下一页
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
        >
          −
        </Button>
        <span className="text-sm">{Math.round(zoom * 100)}%</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setZoom(Math.min(3, zoom + 0.25))}
        >
          ＋
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

export default function PdfCanvas({ activeFilePath }: { activeFilePath: string }) {
  const { workspace } = useWorkspace()
  const [result, setResult] = useState<{ path: string; bytes?: Uint8Array; error?: string }>()
  useEffect(() => {
    let active = true
    void window.electronAPI
      .readTransitFile(workspace.path, activeFilePath)
      .then((file) => {
        if (active && file.kind === "pdf") setResult({ path: activeFilePath, bytes: file.bytes })
      })
      .catch((error) => {
        if (active) setResult({ path: activeFilePath, error: String(error) })
      })
    return () => {
      active = false
    }
  }, [workspace.path, activeFilePath])
  if (result?.path !== activeFilePath) return <p className="p-4 text-sm">正在读取 PDF…</p>
  if (result.error)
    return (
      <p
        role="alert"
        className="p-4 text-sm text-red-500"
      >
        {result.error}
      </p>
    )
  return result.bytes ? (
    <PdfDocument
      bytes={result.bytes}
      name={activeFilePath.split("/").pop() || "PDF"}
    />
  ) : null
}
