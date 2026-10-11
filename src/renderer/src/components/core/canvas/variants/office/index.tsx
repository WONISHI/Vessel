import { useEffect, useRef, useState } from "react"
import { EditorLoading } from "@/components/ui/editor-loading"
import { StatusSlot } from "@/pages/workspace/components/layout-main/status-slot"

export default function OfficeCanvas({ activeFilePath }: { activeFilePath: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const [status, setStatus] = useState("正在加载…")
  useEffect(() => {
    let active = true
    let document: Awaited<ReturnType<typeof window.electronAPI.readOfficePath>> | undefined
    let ready = false
    let origin = ""
    const initialize = () => {
      if (active && ready && document) frame.current?.contentWindow?.postMessage({ type: "office:init", doc: { id: activeFilePath, name: document.name, file: new File([document.bytes as BlobPart], document.name) } }, origin)
    }
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== origin) return
      if (event.data?.type === "office:ready") { ready = true; initialize() }
      if (event.data?.type === "office:state") setStatus(event.data.dirty ? "未保存" : event.data.status || "本地编辑")
      if (event.data?.type === "office:save" && event.ports[0] && document) {
        const port = event.ports[0]
        const extension = /\.(xlsx?|ods|csv)$/i.test(document.name) ? ".xlsx" : /\.(pptx?|odp)$/i.test(document.name) ? ".pptx" : ".docx"
        const name = document.name.replace(/\.[^.]+$/, "") + extension
        void window.electronAPI.commitOffice(name, event.data.bytes, document.token).then(result => {
          if (result.saved) { document!.token = result.token!; document!.name = result.name || name; setStatus("已保存") }
          port.postMessage(result)
        }, reason => { setError(String(reason)); port.postMessage({ error: String(reason) }) }).finally(() => port.close())
      }
    }
    window.addEventListener("message", listener)
    void Promise.all([window.electronAPI.openOffice(), window.electronAPI.readOfficePath(activeFilePath)]).then(([address, file]) => {
      if (!active) return
      origin = new URL(address).origin; document = file
      setUrl(address + "?editor=1&embedded=1")
      initialize()
    }).catch(reason => { if (active) setError(String(reason)) })
    return () => { active = false; window.removeEventListener("message", listener) }
  }, [activeFilePath])
  return <div className="relative flex min-h-0 flex-1 flex-col">
    {url ? <iframe ref={frame} title={`ONLYOFFICE ${activeFilePath.split(/[\\/]/).pop()}`} src={url} className="min-h-0 w-full flex-1 border-0" /> : !error && <EditorLoading kind="office" />}
    {error && <p role="alert" className="p-4 text-sm text-red-600">{error}</p>}
    <StatusSlot><span className="px-2 text-xs text-stone-500">{status}</span></StatusSlot>
  </div>
}
