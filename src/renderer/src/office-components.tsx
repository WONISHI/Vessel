import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { OnlyOfficeEditor } from "wasm-onlyoffice-sdk/react"
import { FileText, FileSpreadsheet, Presentation, Plus, X, FolderOpen, Save } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover"
type Doc = { id: string; file?: File; newDocument?: "docx" | "xlsx" | "pptx"; name: string; dirty?: boolean; status?: string }
const kinds = [{ type: "docx", label: "Word 文档", Icon: FileText, color: "#2563eb" }, { type: "xlsx", label: "Excel 表格", Icon: FileSpreadsheet, color: "#16a34a" }, { type: "pptx", label: "PPT 演示文稿", Icon: Presentation, color: "#d97706" }] as const
export function Editor() {
  const [doc, setDoc] = useState<Doc>()
  const report = (data: object) => parent.postMessage({ type: "office:state", ...data }, location.origin)
  useEffect(() => {
    const init = (event: MessageEvent) => {
      if (event.source !== parent || event.origin !== location.origin) return
      if (event.data?.type === "office:init") setDoc(event.data.doc)
      if (event.data?.type === "office:export") {
        const runtime = (document.querySelector<HTMLIFrameElement>('iframe[name="frameEditor"]')?.contentWindow as (Window & { Asc?: { editor?: { asc_DownloadAs(options: unknown): void }; asc_CDownloadOptions: new (format: number) => unknown; c_oAscFileType: Record<string, number> } }) | null)?.Asc
        if (!runtime?.editor) { report({ status: "编辑器尚未就绪，请稍后重试" }); return }
        try { runtime.editor.asc_DownloadAs(new runtime.asc_CDownloadOptions(runtime.c_oAscFileType[event.data.format])) }
        catch (error) { report({ status: `导出失败：${String(error)}` }) }
      }
    }
    window.addEventListener("message", init)
    parent.postMessage({ type: "office:ready" }, location.origin)
    return () => window.removeEventListener("message", init)
  }, [])
  return doc ? <OnlyOfficeEditor assetsPath="/office/v9.3.0.24-1" x2tPath="/office/x2t" file={doc.file} newDocument={doc.newDocument} language="zh" theme="theme-classic-light" user={{ id: "local", name: "本地用户" }} style={{ height: "100vh" }} onReady={() => report({ status: "本地编辑" })} onDocumentStateChange={dirty => { if (dirty) report({ dirty: true }) }} onError={error => report({ status: `加载失败：${error.message}` })} onSave={async (blob, name) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = event => { report(event.data.saved ? { dirty: false, status: "已保存", name } : { status: event.data.error || "已取消保存" }); channel.port1.close() }
    parent.postMessage({ type: "office:save", name, bytes: new Uint8Array(await blob.arrayBuffer()) }, location.origin, [channel.port2])
  }} /> : <p style={{ padding: 24 }}>正在加载本地编辑器…</p>
}
export function Office() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [active, setActive] = useState("")
  const [menu, setMenu] = useState(false)
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
      if (event.data?.type === "office:save" && event.ports[0]) parent.postMessage(event.data, "*", [event.ports[0]])
    }
    const leave = (event: BeforeUnloadEvent) => { if (docsRef.current.some(doc => doc.dirty)) { event.preventDefault(); event.returnValue = "" } }
    window.addEventListener("message", listener); window.addEventListener("beforeunload", leave)
    return () => { window.removeEventListener("message", listener); window.removeEventListener("beforeunload", leave) }
  }, [])
  const add = (file?: File, newDocument?: Doc["newDocument"]) => {
    const id = crypto.randomUUID()
    setDocs(items => [...items, { id, file, newDocument, name: file?.name || `未命名-${items.length + 1}.${newDocument}`, status: "正在加载…" }]); setActive(id); setMenu(false)
  }
  const close = (doc: Doc) => {
    if (doc.dirty && !confirm(`“${doc.name}”有未保存修改，仍要关闭吗？`)) return
    const next = docs.filter(item => item.id !== doc.id); setDocs(next); if (active === doc.id) setActive(next.at(-1)?.id || "")
  }
  const selected = docs.find(doc => doc.id === active)
  return <div className="flex h-screen flex-col bg-white text-stone-800" style={{ fontFamily: "system-ui" }}>
    <div className="flex h-11 shrink-0 items-stretch border-b bg-stone-50" role="tablist" aria-label="Office 文档">
      <div className="flex min-w-0 overflow-x-auto">{docs.map(doc => { const kind = kinds.find(kind => doc.name.endsWith(kind.type)) || kinds[0]; return <div key={doc.id} className={`flex shrink-0 items-center gap-2 border-r border-t-2 px-3 text-xs ${doc.id === active ? "border-t-green-600 bg-white" : "border-t-transparent text-stone-500"}`}><button role="tab" aria-selected={doc.id === active} className="flex items-center gap-2 py-3" onClick={() => setActive(doc.id)}><kind.Icon size={14} color={kind.color} />{doc.name}{doc.dirty ? " •" : ""}</button><button aria-label={`关闭 ${doc.name}`} onClick={() => close(doc)} className="rounded p-1 hover:bg-stone-200"><X size={12} /></button></div> })}</div>
      <Popover open={menu} onOpenChange={setMenu}><PopoverTrigger asChild><button aria-label="新建 Office 文档" className="shrink-0 px-3 hover:bg-stone-100"><Plus size={16} /></button></PopoverTrigger><PopoverContent align="start" className="w-48 p-1">{kinds.map(({ type, label, Icon, color }) => <button key={type} onClick={() => add(undefined, type)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-stone-100"><Icon size={16} color={color} />新建 {label}</button>)}</PopoverContent></Popover>
      <label className="ml-auto flex shrink-0 cursor-pointer items-center gap-2 px-4 text-xs hover:bg-stone-100"><FolderOpen size={15} />打开文件<input type="file" className="hidden" accept=".docx,.doc,.odt,.xlsx,.xls,.ods,.csv,.pptx,.ppt,.odp" onChange={event => { const file = event.target.files?.[0]; if (file) add(file); event.target.value = "" }} /></label>
    </div>
    <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs"><span className="truncate">本地文档 / {selected?.name || "ONLYOFFICE"}</span><div className="flex items-center gap-4"><span className="text-stone-500">{selected?.dirty ? "未保存 · " : ""}{selected?.status || "文档仅在本地处理"}</span>{selected && <button className="flex items-center gap-1 rounded bg-green-700 px-3 py-1.5 text-white hover:bg-green-800" onClick={() => frames.current.get(selected.id)?.contentWindow?.postMessage({ type: "office:export", format: selected.name.match(/\.(xlsx?|ods|csv)$/i) ? "XLSX" : selected.name.match(/\.(pptx?|odp)$/i) ? "PPTX" : "DOCX" }, location.origin)}><Save size={13} />另存为</button>}</div></div>
    <div className="relative min-h-0 flex-1">{docs.map(doc => <iframe key={doc.id} ref={frame => { if (frame) frames.current.set(doc.id, frame); else frames.current.delete(doc.id) }} hidden={doc.id !== active} title={doc.name} src="/office.html?editor=1" className="absolute inset-0 h-full w-full border-0" />)}{!docs.length && <div className="flex h-full flex-col items-center justify-center gap-4 text-stone-500"><FileText size={40} className="text-green-600" /><h1 className="text-xl font-semibold text-stone-800">ONLYOFFICE</h1><p className="text-sm">打开本地文件，或点击上方 ＋ 新建 Word、Excel、PPT。</p></div>}</div>
  </div>
}
