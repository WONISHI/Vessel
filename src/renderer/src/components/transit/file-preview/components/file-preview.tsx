import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { codeLanguage } from "@/components/core/canvas/variants/code/language"
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import { PdfDocument } from "@/components/core/canvas/variants/pdf"
import { OfficePreview } from "@/components/transit/file-preview/components/office-preview"
import type { TransitItem } from "@/components/transit/state"
import { Image } from "@/components/ui/image"
import { ScrollArea } from "@/components/ui/scroll-area"
import Editor from "@monaco-editor/react"
import type { TransitFile } from "@vessel/type"
import { useEffect, useState } from "react"

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
  if (file.kind === "image")
    return (
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <Image
            src={file.content}
            alt={item.title}
            resizable={false}
            className="max-w-full object-contain"
          />
        </div>
      </ScrollArea>
    )
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
