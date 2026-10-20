import { EditorLoading } from "@/components/ui/editor-loading"
import type { TransitFile } from "@vessel/type"
import { useEffect, useRef, useState } from "react"

/** Renders the office preview component. */
export function OfficePreview({ file }: { file: Extract<TransitFile, { bytes: Uint8Array }> }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    void window.electronAPI
      .openOffice()
      .then((url) => setUrl(url + "?editor=1&preview=1"))
      .catch((error) => setError(String(error)))
  }, [])
  useEffect(() => {
    if (!url) return

    /** Performs the listener operation. */
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return
      if (event.data?.type === "office:ready") frame.current.contentWindow?.postMessage({ type: "office:init", doc: { id: "preview", name: file.name, file: new File([file.bytes as BlobPart], file.name) } }, new URL(url).origin)
      if (event.data?.type === "office:save") {
        event.ports[0]?.postMessage({ error: "中转站为预览窗口，请在 ONLYOFFICE 中编辑保存" })
        event.ports[0]?.close()
      }
    }
    window.addEventListener("message", listener)
    return () => window.removeEventListener("message", listener)
  }, [url, file])
  return error ? (
    <p
      role="alert"
      className="p-4 text-xs text-red-600"
    >
      {error}
    </p>
  ) : url ? (
    <iframe
      ref={frame}
      data-title={`预览 ${file.name}`} aria-label={`预览 ${file.name}`}
      src={url}
      className="h-full w-full border-0"
    />
  ) : (
    <EditorLoading kind="office" />
  )
}
