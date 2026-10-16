import { EditorLoading } from "@/components/ui/editor-loading"
import { Doc } from "@/features/office/components/office-components-shared"
import { loadOfficeAPI } from "@/features/office/office-loader"
import { useEffect, useState } from "react"
import { OnlyOfficeEditor } from "wasm-onlyoffice-sdk/react"

/** Renders the editor component. */
export function Editor() {
  const [ready, setReady] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [doc, setDoc] = useState<Doc>()
  useEffect(() => {
    let active = true
    void loadOfficeAPI().then(
      () => {
        if (active) setApiReady(true)
      },
      (error) => {
        if (active) setLoadError(String(error))
      }
    )
    return () => {
      active = false
    }
  }, [])
  const preview = new URLSearchParams(location.search).has("preview")
  const embedded = preview || new URLSearchParams(location.search).has("embedded")

  /** Performs the report operation. */
  const report = (data: object) => parent.postMessage({ type: "office:state", ...data }, embedded ? "*" : location.origin)
  useEffect(() => {
    /** Initializes init. */
    const init = (event: MessageEvent) => {
      if (event.source !== parent || (!embedded && event.origin !== location.origin)) return
      if (event.data?.type === "office:init") {
        setReady(false)
        setLoadError("")
        setDoc(event.data.doc)
      }
      if (event.data?.type === "office:export") {
        const runtime = (document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow as (Window & { Asc?: { editor?: { asc_DownloadAs(options: unknown): void }; asc_CDownloadOptions: new (format: number) => unknown; c_oAscFileType: Record<string, number> } }) | null)?.Asc
        if (!runtime?.editor) {
          report({ status: "编辑器尚未就绪，请稍后重试" })
          return
        }
        try {
          runtime.editor.asc_DownloadAs(new runtime.asc_CDownloadOptions(runtime.c_oAscFileType[event.data.format]))
        } catch (error) {
          report({ status: `导出失败：${String(error)}` })
        }
      }
    }
    window.addEventListener("message", init)
    parent.postMessage({ type: "office:ready" }, embedded ? "*" : location.origin)
    return () => window.removeEventListener("message", init)
  }, [embedded])
  return (
    <div className="relative h-screen">
      {doc && apiReady && (
        <OnlyOfficeEditor
          assetsPath="/office/v9.3.0.24-1"
          x2tPath="/office/x2t"
          file={doc.file}
          newDocument={doc.newDocument}
          language="zh"
          theme="theme-classic-light"
          user={{ id: "local", name: "本地用户" }}
          style={{ height: "100vh" }}
          onReady={() => {
            setReady(true)
            if (preview) {
              const runtime = (document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow as (Window & { Asc?: { editor?: { asc_setViewMode?: (view: boolean) => void } } }) | null)?.Asc
              runtime?.editor?.asc_setViewMode?.(true)
            }
            report({ status: "本地编辑" })
          }}
          onDocumentStateChange={(dirty) => {
            if (dirty) report({ dirty: true })
          }}
          onError={(error) => {
            setLoadError(error.message)
            report({ status: `加载失败：${error.message}` })
          }}
          onSave={async (blob, name) => {
            const channel = new MessageChannel()
            channel.port1.onmessage = (event) => {
              report(event.data.saved ? { dirty: false, status: "已保存" } : { status: event.data.error || "已取消保存" })
              channel.port1.close()
            }
            parent.postMessage({ type: "office:save", name, bytes: new Uint8Array(await blob.arrayBuffer()) }, embedded ? "*" : location.origin, [channel.port2])
          }}
        />
      )}
      {!ready && !loadError && (
        <div className="absolute inset-0">
          <EditorLoading kind="office" />
        </div>
      )}
      {loadError && (
        <div
          role="alert"
          className="absolute inset-0 flex items-center justify-center bg-white p-6 text-red-600"
        >
          加载失败：{loadError}
        </div>
      )}
    </div>
  )
}
