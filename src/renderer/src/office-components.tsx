import { EditorLoading } from "./components/ui/editor-loading"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { OnlyOfficeEditor } from "wasm-onlyoffice-sdk/react"
import { FileText, FileSpreadsheet, Presentation, Plus, X, FolderOpen, Save } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover"
import { PdfDocument } from "./components/pdf-document"
type Doc = { id: string; token?: string; file?: File; newDocument?: "docx" | "xlsx" | "pptx"; name: string; dirty?: boolean; status?: string }
function requestHost<T>(data: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => { channel.port1.close(); reject(new Error("操作超时，请重试")) }, 300000)
    channel.port1.onmessage = event => { clearTimeout(timeout); channel.port1.close(); if (event.data.error) reject(new Error(event.data.error)); else resolve(event.data.result) }
    parent.postMessage(data, "*", [channel.port2])
  })
}
const kinds = [{ type: "docx", label: "Word 文档", Icon: FileText, color: "#2563eb" }, { type: "xlsx", label: "Excel 表格", Icon: FileSpreadsheet, color: "#16a34a" }, { type: "pptx", label: "PPT 演示文稿", Icon: Presentation, color: "#d97706" }] as const
const pdfKind = { type: "pdf", Icon: FileText, color: "#dc2626" } as const
const isPdf = (name: string) => /\.pdf$/i.test(name)
/** PDF 使用 react-pdf 只读预览，不进入 ONLYOFFICE 编辑器。 */
function PdfPane({ doc, hidden }: { doc: Doc; hidden: boolean }) {
  const [bytes, setBytes] = useState<Uint8Array>()
  const [error, setError] = useState("")
  useEffect(() => { void doc.file?.arrayBuffer().then(buffer => setBytes(new Uint8Array(buffer)), reason => setError(String(reason))) }, [doc.file])
  return <div hidden={hidden} className="absolute inset-0 flex bg-white">{bytes ? <PdfDocument bytes={bytes} name={doc.name} /> : <p role={error ? "alert" : undefined} className={`p-4 text-sm ${error ? "text-red-500" : "text-stone-500"}`}>{error || "正在读取 PDF…"}</p>}</div>
}
export function Editor() {
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState("")
  const [doc, setDoc] = useState<Doc>()
  const preview = new URLSearchParams(location.search).has("preview")
  const report = (data: object) => parent.postMessage({ type: "office:state", ...data }, preview ? "*" : location.origin)
  useEffect(() => {
    const init = (event: MessageEvent) => {
      if (event.source !== parent || (!preview && event.origin !== location.origin)) return
      if (event.data?.type === "office:init") { setReady(false); setLoadError(""); setDoc(event.data.doc) }
      if (event.data?.type === "office:export") {
        const runtime = (document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow as (Window & { Asc?: { editor?: { asc_DownloadAs(options: unknown): void }; asc_CDownloadOptions: new (format: number) => unknown; c_oAscFileType: Record<string, number> } }) | null)?.Asc
        if (!runtime?.editor) { report({ status: "编辑器尚未就绪，请稍后重试" }); return }
        try { runtime.editor.asc_DownloadAs(new runtime.asc_CDownloadOptions(runtime.c_oAscFileType[event.data.format])) }
        catch (error) { report({ status: `导出失败：${String(error)}` }) }
      }
    }
    window.addEventListener("message", init)
    parent.postMessage({ type: "office:ready" }, preview ? "*" : location.origin)
    return () => window.removeEventListener("message", init)
  }, [preview])
  return <div className="relative h-screen">{doc && <OnlyOfficeEditor assetsPath="/office/v9.3.0.24-1" x2tPath="/office/x2t" file={doc.file} newDocument={doc.newDocument} language="zh" theme="theme-classic-light" user={{ id: "local", name: "本地用户" }} style={{ height: "100vh" }} onReady={() => {
    setReady(true)
    if (preview) { const runtime = (document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow as (Window & { Asc?: { editor?: { asc_setViewMode?: (view: boolean) => void } } }) | null)?.Asc; runtime?.editor?.asc_setViewMode?.(true) }
    report({ status: "本地编辑" })
  }} onDocumentStateChange={dirty => { if (dirty) report({ dirty: true }) }} onError={error => { setLoadError(error.message); report({ status: `加载失败：${error.message}` }) }} onSave={async (blob, name) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = event => { report(event.data.saved ? { dirty: false, status: "已保存" } : { status: event.data.error || "已取消保存" }); channel.port1.close() }
    parent.postMessage({ type: "office:save", name, bytes: new Uint8Array(await blob.arrayBuffer()) }, preview ? "*" : location.origin, [channel.port2])
  }} />}{!ready && !loadError && <div className="absolute inset-0"><EditorLoading kind="office" /></div>}{loadError && <div role="alert" className="absolute inset-0 flex items-center justify-center bg-white p-6 text-red-600">加载失败：{loadError}</div>}</div>
}
export function Office() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [active, setActive] = useState("")
  const [menu, setMenu] = useState(false)
  const [renameName, setRenameName] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const frames = useRef(new Map<string, HTMLIFrameElement>())
  const docsRef = useRef(docs)
  useLayoutEffect(() => { docsRef.current = docs }, [docs])
  useEffect(() => {
    parent.postMessage({ type: "office:loaded" }, "*")
    const listener = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      const id = [...frames.current].find(([, frame]) => frame.contentWindow === event.source)?.[0]
      if (!id) return
      if (event.data?.type === "office:ready") (event.source as Window).postMessage({ type: "office:init", doc: docsRef.current.find(doc => doc.id === id) }, location.origin)
      if (event.data?.type === "office:state") setDocs(items => items.map(doc => doc.id === id ? { ...doc, dirty: event.data.dirty ?? doc.dirty, status: event.data.status ?? doc.status, name: event.data.name ?? doc.name } : doc))
      if (event.data?.type === "office:save" && event.ports[0]) {
        const doc = docsRef.current.find(doc => doc.id === id)!
        const extension = /\.(xlsx?|ods|csv)$/i.test(doc.name) ? ".xlsx" : /\.(pptx?|odp)$/i.test(doc.name) ? ".pptx" : ".docx"
        const name = doc.name.replace(/\.[^.]+$/, "") + extension
        const port = event.ports[0]
        void requestHost<{ saved: boolean; token?: string; name?: string }>({ ...event.data, name, token: doc.token }).then(result => {
          if (result.saved) setDocs(items => items.map(item => item.id === id ? { ...item, token: result.token, name: result.name || item.name, dirty: false } : item))
          port.postMessage(result)
        }, error => port.postMessage({ error: String(error) })).finally(() => port.close())
      }
    }
    const leave = (event: BeforeUnloadEvent) => { if (docsRef.current.some(doc => doc.dirty)) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("message", listener); window.addEventListener("beforeunload", leave)
    return () => { window.removeEventListener("message", listener); window.removeEventListener("beforeunload", leave) }
  }, [])
  const add = (file?: File, newDocument?: Doc["newDocument"], token?: string) => {
    const id = crypto.randomUUID()
    setDocs(items => [...items, { id, file, newDocument, token, name: file?.name || `未命名-${items.length + 1}.${newDocument}`, status: "正在加载…" }]); setActive(id); setMenu(false)
  }
  const close = (doc: Doc) => {
    if (doc.dirty && !confirm(`“${doc.name}”有未保存修改，仍要关闭吗？`)) return
    const next = docs.filter(item => item.id !== doc.id); setDocs(next); if (active === doc.id) setActive(next.at(-1)?.id || "")
  }
  const selected = docs.find(doc => doc.id === active)
  return <div className="flex h-screen flex-col bg-white text-stone-800" style={{ fontFamily: "system-ui" }}>
    <div className="flex h-11 shrink-0 items-stretch border-b bg-stone-50" role="tablist" aria-label="Office 文档">
      <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
        {docs.map(doc => { const kind = kinds.find(kind => doc.name.endsWith(kind.type)) || kinds[0]; return <div key={doc.id} className={`group flex min-w-0 items-center gap-2 border-r border-t-2 px-3 text-xs ${doc.id === active ? "flex-[1.2] max-w-[176px] border-t-green-600 bg-white font-medium text-stone-800" : "flex-1 max-w-[140px] border-t-transparent text-stone-500"}`}><button role="tab" aria-selected={doc.id === active} className="flex min-w-0 flex-1 items-center gap-2 py-3" onClick={() => setActive(doc.id)}><kind.Icon className="shrink-0" size={14} color={kind.color} /><span className="truncate">{doc.name}</span><span className="shrink-0">{doc.dirty ? " •" : ""}</span></button><button aria-label={`关闭 ${doc.name}`} onClick={() => close(doc)} className="shrink-0 rounded p-1 hover:bg-stone-200"><X size={12} /></button></div> })}
        <Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><button aria-label="新建 Office 文档" className="shrink-0 px-3 text-stone-600 hover:text-stone-900"><Plus size={16} /></button></PopoverTrigger><PopoverContent align="start" className="w-48 p-1">{kinds.map(({ type, label, Icon, color }) => <button key={type} onClick={() => add(undefined, type)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-stone-100"><Icon size={16} color={color} />新建 {label}</button>)}</PopoverContent></Popover>
      </div>
      <button className="ml-auto flex shrink-0 items-center gap-2 px-4 text-xs hover:bg-stone-100" onClick={() => { void requestHost<{ token: string; name: string; bytes: Uint8Array } | null>({ type: "office:pick" }).then(result => { if (result) add(new File([result.bytes as BlobPart], result.name), undefined, result.token) }).catch(error => setMessage(String(error))) }}><FolderOpen size={15} />打开文件</button>
    </div>
    <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs"><span className="truncate">本地文档 / {selected?.name || "ONLYOFFICE"}{selected?.dirty ? " · 未保存" : ""}</span><div className="flex items-center gap-4">{selected && <Popover open={renameName !== null} onOpenChange={open => setRenameName(open ? selected.name : null)}><PopoverTrigger asChild><button className="text-stone-500 hover:text-green-700">重命名</button></PopoverTrigger><PopoverContent className="w-64 p-3"><form className="flex gap-2" onSubmit={event => { event.preventDefault(); if (!renameName) return; void requestHost<string>({ type: "office:rename", token: selected.token, name: renameName }).then(name => { setDocs(items => items.map(doc => doc.id === selected.id ? { ...doc, name } : doc)); setRenameName(null) }).catch(error => setMessage(String(error))) }}><input aria-label="文档名称" autoFocus className="min-w-0 flex-1 rounded border px-2 text-xs" value={renameName || ""} onChange={e => setRenameName(e.target.value)} /><button className="rounded bg-green-700 px-2 py-1 text-xs text-white">确定</button></form></PopoverContent></Popover>}{selected && <button className="flex items-center gap-1 rounded bg-green-700 px-3 py-1.5 text-white hover:bg-green-800" onClick={() => frames.current.get(selected.id)?.contentWindow?.postMessage({ type: "office:export", format: selected.name.match(/\.(xlsx?|ods|csv)$/i) ? "XLSX" : selected.name.match(/\.(pptx?|odp)$/i) ? "PPTX" : "DOCX" }, location.origin)}><Save size={13} />保存</button>}</div></div>
    {message && <div role="alert" className="flex justify-between bg-red-50 px-4 py-2 text-xs text-red-600">{message}<button onClick={() => setMessage("")}>关闭</button></div>}
    {selected?.status && !["本地编辑", "已保存", "正在加载…"].includes(selected.status) && <p role="alert" className="px-4 text-xs text-red-600">{selected.status}</p>}
    <div className="relative min-h-0 flex-1">{docs.map(doc => <iframe key={doc.id} ref={frame => { if (frame) frames.current.set(doc.id, frame); else frames.current.delete(doc.id) }} hidden={doc.id !== active} title={doc.name} src="/office.html?editor=1" className="absolute inset-0 h-full w-full border-0" />)}{!docs.length && <div className="flex h-full flex-col items-center justify-center gap-4 text-stone-500"><FileText size={40} className="text-green-600" /><h1 className="text-xl font-semibold text-stone-800">ONLYOFFICE</h1><p className="text-sm">打开本地文件，或点击上方 ＋ 新建 Word、Excel、PPT。</p></div>}</div>
  </div>
}
