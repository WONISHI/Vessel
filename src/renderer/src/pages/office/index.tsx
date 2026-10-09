import { EditorLoading } from "@/components/ui/editor-loading"
import { useEffect, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { useRouter } from "@vessel/react-router"
import Layout from "@/layout"
import ActivityBar from "@/layout/activity-bar"
function OfficePage() {
  const router = useRouter()
  const frame = useRef<HTMLIFrameElement>(null)
  const [url, setUrl] = useState("")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { void window.electronAPI.openOffice().then(setUrl).catch(reason => setError(String(reason))) }, [])
  useEffect(() => {
    if (!url) return
    const timeout = setTimeout(() => setError("Office 页面加载超时，请重启 Vessel 后重试。"), 20000)
    const listener = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== new URL(url).origin) return
      if (event.data?.type === "office:loaded") { clearTimeout(timeout); setReady(true); setError(""); return }
      const port = event.ports[0]
      if (!port) return
      const data = event.data
      const request = data?.type === "office:pick" ? window.electronAPI.pickOfficeFile()
        : data?.type === "office:rename" ? window.electronAPI.renameOffice(data.token, data.name)
        : data?.type === "office:save" ? window.electronAPI.commitOffice(data.name, data.bytes, data.token) : null
      if (request) void request.then(result => port.postMessage({ result }), error => port.postMessage({ error: String(error) })).finally(() => port.close())
    }
    window.addEventListener("message", listener)
    return () => { clearTimeout(timeout); window.removeEventListener("message", listener) }
  }, [url])
  useEffect(() => {
    if (!ready || !url) return
    let queue = Promise.resolve()
    const flush = () => {
      const paths = JSON.parse(sessionStorage.getItem("office-pending-paths") || "[]") as string[]
      sessionStorage.removeItem("office-pending-paths")
      for (const path of paths) queue = queue.then(async () => {
        const document = await window.electronAPI.readOfficePath(path)
        frame.current?.contentWindow?.postMessage({ type: "office:external", document }, new URL(url).origin)
      }).catch(reason => setError(String(reason)))
    }
    window.addEventListener("vessel:office-open", flush); flush()
    return () => window.removeEventListener("vessel:office-open", flush)
  }, [ready, url])
  return <Layout aside={<ActivityBar activity="office" onActivityChange={item => void router.push(item === "tools" ? "/devtools" : item === "files" ? "/editor" : `/${item}`)} />}>
    <main className="relative h-full min-w-0 flex-1">
      {url && <iframe ref={frame} title="ONLYOFFICE 本地编辑器" src={url} className="h-full w-full border-0" />}
      {!ready && !error && <div className="absolute inset-0"><EditorLoading kind="office" /></div>}
      {error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white"><p role={error ? "alert" : "status"}>{error || "正在打开 ONLYOFFICE…"}</p>{error && <button className="rounded border px-3 py-1 text-sm" onClick={() => { setError(""); setReady(false); setUrl(""); void window.electronAPI.openOffice().then(setUrl).catch(reason => setError(String(reason))) }}>重新加载</button>}</div>}
    </main>
  </Layout>
}
export function OfficeKeepAlive() {
  const visible = useLocation().pathname === "/office"
  const [visited, setVisited] = useState(visible)
  if (visible && !visited) setVisited(true)
  return visited ? <div hidden={!visible} className="h-full w-full"><OfficePage /></div> : null
}
export function OfficeRoute() { return null }
