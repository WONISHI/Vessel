import { useEffect, useRef, useState } from "react"
import type { PdfExportOptions } from "@vessel/type/native-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import { markdownDocuments } from "@/components/native-file-menu/document-bridge"
import { pdfDocumentHtml } from "./export-html"
import { toast } from "sonner"

const defaults: PdfExportOptions = { paper: "A4", landscape: false, marginMm: 18, fontSize: 14, printBackground: true, pageNumbers: false }

/** Confirm a page layout before exporting a workspace Markdown file, open or unopened. */
export default function PdfExportDialog({ path, root, onClose }: { path: string; root: string; onClose: () => void }) {
  const [options, setOptions] = useState<PdfExportOptions>(defaults)
  const [source, setSource] = useState<string>()
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const preview = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => markdownDocuments.get(path)?.content() ?? (await window.electronAPI.readContent(path))
    void load().then(
      (text) => {
        if (!cancelled) setSource(text)
      },
      (reason) => {
        if (!cancelled) setError(String(reason))
      }
    )
    return () => {
      cancelled = true
    }
  }, [path])
  const change = (patch: Partial<PdfExportOptions>) => setOptions((current) => ({ ...current, ...patch }))
  const exportPdf = async () => {
    if (busy || !ready) return
    setBusy(true)
    setError("")
    try {
      if (!Number.isFinite(options.marginMm) || options.marginMm < 0 || options.marginMm > 50 || !Number.isFinite(options.fontSize) || options.fontSize < 8 || options.fontSize > 32) throw new Error("页边距应为 0–50 毫米，字号应为 8–32 px")
      if (options.pageNumbers && options.marginMm < 10) throw new Error("显示页码时页边距至少为 10 毫米")
      const editor = preview.current?.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      if (!editor) throw new Error("文档尚未渲染完成")
      const html = await pdfDocumentHtml(editor, root, path)
      const output = await window.electronAPI.fileMenuDialog({ action: "pdf", defaultPath: path.replace(/\.(md|markdown)$/i, ".pdf"), html, pdfOptions: options })
      if (output) {
        toast.success("PDF 已导出")
        onClose()
      }
    } catch (reason) {
      setError(String(reason).replace(/^Error: /, ""))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[90vh] max-w-[760px] flex-col gap-4"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>导出 PDF</DialogTitle>
          <DialogDescription className="truncate">{path.split(/[\\/]/).pop()} · 配置页面后选择保存位置</DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={busy}
          className="grid shrink-0 grid-cols-2 gap-4 text-xs sm:grid-cols-4"
        >
          <label className="space-y-2">
            <span>纸张大小</span>
            <Select
              value={options.paper}
              onValueChange={(paper) => change({ paper: paper as PdfExportOptions["paper"] })}
            >
              <SelectTrigger aria-label="纸张大小">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["A4", "A3", "A5", "Letter", "Legal"].map((paper) => (
                  <SelectItem
                    key={paper}
                    value={paper}
                  >
                    {paper}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2">
            <span>页面方向</span>
            <Select
              value={options.landscape ? "landscape" : "portrait"}
              onValueChange={(direction) => change({ landscape: direction === "landscape" })}
            >
              <SelectTrigger aria-label="页面方向">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">纵向</SelectItem>
                <SelectItem value="landscape">横向</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-2">
            <span>页边距（mm）</span>
            <Input
              aria-label="页边距"
              type="number"
              min={0}
              max={50}
              value={options.marginMm}
              onChange={(event) => change({ marginMm: event.target.valueAsNumber })}
            />
          </label>
          <label className="space-y-2">
            <span>正文字号（px）</span>
            <Input
              aria-label="正文字号"
              type="number"
              min={8}
              max={32}
              value={options.fontSize}
              onChange={(event) => change({ fontSize: event.target.valueAsNumber })}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.printBackground}
              onChange={(event) => change({ printBackground: event.target.checked })}
            />
            打印背景颜色
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options.pageNumbers}
              onChange={(event) => change({ pageNumbers: event.target.checked })}
            />
            显示页码
          </label>
        </fieldset>
        <p className="shrink-0 text-xs text-stone-400">以下为内容预览，最终分页以所选纸张和方向为准。</p>
        <div
          ref={preview}
          className="h-64 min-h-0 shrink overflow-hidden rounded-lg border bg-white text-stone-800"
        >
          {source !== undefined ? (
            <VditorEditor
              readOnly
              value={source}
              workspacePath={root}
              documentPath={path}
              onChange={() => {}}
              onReady={() => setReady(true)}
            />
          ) : (
            <p className="p-4 text-xs text-stone-400">正在读取文档…</p>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="shrink-0 whitespace-pre-wrap text-xs text-red-500"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={!ready || busy}
            onClick={() => void exportPdf()}
          >
            {busy ? "正在导出…" : ready ? "导出 PDF" : "正在渲染…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
