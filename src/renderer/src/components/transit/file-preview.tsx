import { PdfDocument } from '@/components/core/canvas/variants/pdf'
import { useEffect, useRef, useState } from "react"
import type { TransitFile } from "../../../../shared/transit"
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import type { TransitItem } from "./state"
function OfficePreview({ file }: { file: Extract<TransitFile, { bytes: Uint8Array }> }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  useEffect(() => { void window.electronAPI.openOffice().then(url => setUrl(url + "?editor=1&preview=1")).catch(error => setError(String(error))) }, [])
  useEffect(() => {
    if (!url) return
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return
      if (event.data?.type === "office:ready") frame.current.contentWindow?.postMessage({ type: "office:init", doc: { id: "preview", name: file.name, file: new File([file.bytes as BlobPart], file.name) } }, new URL(url).origin)
      if (event.data?.type === "office:save") { event.ports[0]?.postMessage({ error: "中转站为预览窗口，请在 ONLYOFFICE 中编辑保存" }); event.ports[0]?.close() }
    }
    window.addEventListener("message", listener); return () => window.removeEventListener("message", listener)
  }, [url, file])
  return error ? <p role="alert" className="p-4 text-xs text-red-600">{error}</p> : url ? <iframe ref={frame} title={`预览 ${file.name}`} src={url} className="h-full w-full border-0" /> : <p className="p-4 text-xs">正在打开文档…</p>
}
export function FilePreview({ item }: { item: TransitItem }) {
  const [file, setFile] = useState<TransitFile>()
  const [error, setError] = useState("")
  useEffect(() => { let alive = true; void window.electronAPI.readTransitFile(item.root!, item.content).then(data => { if (alive) setFile(data) }, error => { if (alive) setError(String(error)) }); return () => { alive = false } }, [item.root, item.content])
  if (error) return <p role="alert" className="p-5 text-sm text-red-600">无法预览：{error}</p>
  if (!file) return <p className="p-5 text-sm text-stone-400">正在读取文件…</p>
  if (file.kind === "pdf") return <PdfDocument bytes={file.bytes} name={file.name} />
  if (file.kind === "office") return <div className="min-h-0 flex-1"><OfficePreview file={file} /></div>
  if (file.kind === "markdown") return <div className="min-h-0 flex-1 overflow-auto [&_.vditor-reset]:!opacity-100 [&_.vditor-reset]:!cursor-text"><VditorEditor value={file.content} workspacePath={item.root!} documentPath={item.content} readOnly onChange={() => {}} /></div>
  if (file.kind === "image") return <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-4"><img src={file.content} alt={item.title} className="max-w-full object-contain" /></div>
  return <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 text-xs leading-6">{file.content}</pre>
}
