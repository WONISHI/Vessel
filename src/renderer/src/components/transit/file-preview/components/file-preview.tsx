import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { codeLanguage } from "@/components/core/canvas/variants/code/language"
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import { PdfDocument } from "@/components/core/canvas/variants/pdf"
import { OfficePreview } from "@/components/transit/file-preview/components/office-preview"
import type { TransitItem } from "@/components/transit/state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import Editor from "@monaco-editor/react"
import type { TransitFile } from "@vessel/type"
import { useEffect, useState } from "react"

/** Image preview in the same layout as the workspace image page (canvas + details), shown at its original size without the edit toolbar. */
function TransitImageViewer({ src, name }: { src: string; name: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const mime = /^data:([^;,]+)/.exec(src)?.[1] ?? "image"
  const bytes = src.startsWith("data:") && src.includes(";base64,") ? Math.floor((src.length - src.indexOf(",") - 1) * 3 / 4) : 0
  const details: [string, string][] = [
    ["文件名", name],
    ["格式", mime],
    ["原始宽高", size.width ? `${size.width} × ${size.height} px` : "—"],
    ["像素总数", size.width ? `${(size.width * size.height).toLocaleString()} 像素` : "—"],
    ["原始宽高比", size.height ? (size.width / size.height).toFixed(3) : "—"],
    ["显示比例", "100%（原始尺寸）"],
    ...(bytes ? [["文件大小", `${bytes.toLocaleString()} 字节（${(bytes / 1024).toFixed(1)} KB）`] as [string, string]] : [])
  ]
  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(180px,260px)] gap-4 overflow-hidden bg-white p-4">
      <ScrollArea className="min-h-0 min-w-0 rounded-xl bg-stone-50 [&_[data-radix-scroll-area-viewport]>div]:!flex [&_[data-radix-scroll-area-viewport]>div]:min-h-full">
        <div className="flex min-w-0 flex-1 items-center justify-center p-4">
          <img
            src={src}
            alt={name}
            draggable={false}
            className="block max-w-none shrink-0"
            onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          />
        </div>
      </ScrollArea>
      <ScrollArea className="min-h-0 min-w-0 pr-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
        <Card>
          <CardHeader className="p-4"><CardTitle className="text-sm">图片详细信息</CardTitle></CardHeader>
          <CardContent className="space-y-3 px-4 pb-4">
            {details.map(([label, value]) => (
              <div key={label} className="text-xs">
                <dt className="mb-1 text-stone-400">{label}</dt>
                <dd className="break-all">{value}</dd>
              </div>
            ))}
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  )
}

/** Renders the file preview component. */
export function FilePreview({ item, onLoaded }: { item: TransitItem; onLoaded?: (file: TransitFile) => void }) {
  const dark = useDarkAppearance()
  const [file, setFile] = useState<TransitFile>()
  const [error, setError] = useState("")
  useEffect(() => {
    let alive = true
    void window.electronAPI.readTransitFile(item.root!, item.content).then(
      (data) => {
        if (alive) setFile(data)
      },
      (error) => {
        if (alive) setError(String(error))
      }
    )
    return () => {
      alive = false
    }
  }, [item.root, item.content])
  useEffect(() => { if (file) onLoaded?.(file) }, [file, onLoaded])
  if (error)
    return (
      <p
        role="alert"
        className="p-5 text-sm text-red-600"
      >
        无法预览：{error}
      </p>
    )
  if (!file) return <p className="p-5 text-sm text-stone-400">正在读取文件…</p>
  if (file.kind === "pdf")
    return (
      <PdfDocument
        bytes={file.bytes}
        name={file.name}
        viewStateKey={`transit:${item.root}:${item.content}`}
      />
    )
  if (file.kind === "office")
    return (
      <div className="min-h-0 flex-1">
        <OfficePreview file={file} />
      </div>
    )
  if (file.kind === "markdown")
    return (
      <div className="min-h-0 flex-1 overflow-hidden [&_.vditor-reset]:!opacity-100 [&_.vditor-reset]:!cursor-text">
        <VditorEditor
          value={file.content}
          workspacePath={item.root!}
          documentPath={item.content}
          readOnly
          onChange={() => {}}
        />
      </div>
    )
  if (file.kind === "image") return <TransitImageViewer src={file.content} name={item.title} />
  return (
    <div className="min-h-0 flex-1">
      <Editor
          theme={dark ? "vessel-dark" : "light"}
          beforeMount={registerMonacoTheme}
        height="100%"
        language={codeLanguage(item.content) || "plaintext"}
        value={file.content}
        options={{ readOnly: true, domReadOnly: true, automaticLayout: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: "on" }}
      />
    </div>
  )
}
