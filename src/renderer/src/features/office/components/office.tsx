import { Toaster, toast } from "@/components/ui/sonner"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Doc, isPdf, kinds, pdfKind, requestHost } from "@/features/office/components/office-components-shared"
import { PdfPane } from "@/features/office/components/pdf-pane"
import { FileDown, FileText, FolderOpen, Plus, Save, X } from "lucide-react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"

/** Renders the office component. */
export function Office() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [active, setActive] = useState("")
  const [menu, setMenu] = useState(false)
  const [renameName, setRenameName] = useState<string | null>(null)
  const [converting, setConverting] = useState("")
  const dark = useDarkAppearance()
  const [message, setMessage] = useState("")
  const frames = useRef(new Map<string, HTMLIFrameElement>())
  useEffect(() => {
    frames.current.forEach((frame) => frame.contentWindow?.postMessage({ type: "office:theme", dark }, location.origin))
  }, [dark])
  const docsRef = useRef(docs)
  useLayoutEffect(() => {
    docsRef.current = docs
  }, [docs])
  useEffect(() => {
    parent.postMessage({ type: "office:loaded" }, "*")

    /** Performs the listener operation. */
    const listener = (event: MessageEvent) => {
      if (event.source === parent && event.data?.type === "office:theme") {
        document.documentElement.classList.toggle("dark", event.data.dark === true)
        return
      }
      if (event.source === parent && event.data?.type === "office:external") {
        const doc = event.data.document
        add(new File([doc.bytes], doc.name), undefined, doc.token)
        return
      }
      if (event.origin !== location.origin) return
      const id = [...frames.current].find(([, frame]) => frame.contentWindow === event.source)?.[0]
      if (!id) return
      if (event.data?.type === "office:ready") {
        (event.source as Window).postMessage({ type: "office:theme", dark: document.documentElement.classList.contains("dark") }, location.origin)
        ;(event.source as Window).postMessage({ type: "office:init", doc: docsRef.current.find((doc) => doc.id === id) }, location.origin)
      }
      if (event.data?.type === "office:state") setDocs((items) => items.map((doc) => (doc.id === id ? { ...doc, dirty: event.data.dirty ?? doc.dirty, status: event.data.status ?? doc.status, name: event.data.name ?? doc.name } : doc)))
      if (event.data?.exportFailed) setConverting("")
      if (event.data?.type === "office:convert-markdown" && event.ports[0]) {
        const doc = docsRef.current.find((doc) => doc.id === id)!
        const extension = /\.(xlsx?|ods|csv)$/i.test(doc.name) ? ".xlsx" : /\.(pptx?|odp)$/i.test(doc.name) ? ".pptx" : ".docx"
        const port = event.ports[0]
        void requestHost<{ saved: boolean; path?: string }>({ type: "office:convert-markdown", name: doc.name.replace(/\.[^.]+$/, "") + extension, bytes: event.data.bytes })
          .then(
            (result) => {
              result.saved ? toast.success("Markdown 已保存", { description: result.path }) : toast.info("已取消保存 Markdown")
              port.postMessage(result)
            },
            (error) => {
              setMessage(String(error))
              port.postMessage({ error: String(error) })
            }
          )
          .finally(() => {
            setConverting("")
            port.close()
          })
        return
      }
      if (event.data?.type === "office:save" && event.ports[0]) {
        const doc = docsRef.current.find((doc) => doc.id === id)!
        const extension = /\.(xlsx?|ods|csv)$/i.test(doc.name) ? ".xlsx" : /\.(pptx?|odp)$/i.test(doc.name) ? ".pptx" : ".docx"
        const name = doc.name.replace(/\.[^.]+$/, "") + extension
        const port = event.ports[0]
        void requestHost<{ saved: boolean; token?: string; name?: string }>({ ...event.data, name, token: doc.token })
          .then(
            (result) => {
              if (result.saved) setDocs((items) => items.map((item) => (item.id === id ? { ...item, token: result.token, name: result.name || item.name, dirty: false } : item)))
              port.postMessage(result)
            },
            (error) => port.postMessage({ error: String(error) })
          )
          .finally(() => port.close())
      }
    }

    /** Performs the leave operation. */
    const leave = (event: BeforeUnloadEvent) => {
      if (docsRef.current.some((doc) => doc.dirty)) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("message", listener)
    window.addEventListener("beforeunload", leave)
    return () => {
      window.removeEventListener("message", listener)
      window.removeEventListener("beforeunload", leave)
    }
  }, [])

  /** Adds add. */
  const add = (file?: File, newDocument?: Doc["newDocument"], token?: string) => {
    const id = crypto.randomUUID()
    setDocs((items) => [...items, { id, file, newDocument, token, name: file?.name || `未命名-${items.length + 1}.${newDocument}`, status: file && isPdf(file.name) ? "PDF 预览" : "正在加载…" }])
    setActive(id)
    setMenu(false)
  }

  /** Closes close. */
  const close = (doc: Doc) => {
    if (doc.dirty && !confirm(`“${doc.name}”有未保存修改，仍要关闭吗？`)) return
    const next = docs.filter((item) => item.id !== doc.id)
    setDocs(next)
    if (active === doc.id) setActive(next.at(-1)?.id || "")
  }
  const selected = docs.find((doc) => doc.id === active)
  return (
    <div
      data-office-shell
      className="flex h-screen flex-col bg-white text-stone-800"
      style={{ fontFamily: "system-ui" }}
    >
      <div
        className="flex h-11 shrink-0 items-stretch border-b bg-stone-50"
        role="tablist"
        aria-label="Office 文档"
      >
        <div className="flex min-w-0 flex-1 items-stretch overflow-hidden">
          {docs.map((doc) => {
            const kind = isPdf(doc.name) ? pdfKind : kinds.find((kind) => doc.name.endsWith(kind.type)) || kinds[0]
            return (
              <div
                key={doc.id}
                className={`group flex min-w-0 items-center gap-2 border-r border-t-2 px-3 text-xs ${doc.id === active ? "flex-[1.2] max-w-[176px] border-t-green-600 bg-white font-medium text-stone-800" : "flex-1 max-w-[140px] border-t-transparent text-stone-500"}`}
              >
                <button
                  role="tab"
                  aria-selected={doc.id === active}
                  className="flex min-w-0 flex-1 items-center gap-2 py-3"
                  onClick={() => setActive(doc.id)}
                >
                  <kind.Icon
                    className="shrink-0"
                    size={14}
                    color={kind.color}
                  />
                  <span className="truncate">{doc.name}</span>
                  <span className="shrink-0">{doc.dirty ? " •" : ""}</span>
                </button>
                <button
                  aria-label={`关闭 ${doc.name}`}
                  onClick={() => close(doc)}
                  className="shrink-0 rounded p-1 hover:bg-stone-200"
                >
                  <X size={12} />
                </button>
              </div>
            )
          })}
          <Popover
            open={menu}
            onOpenChange={setMenu}
          >
            <PopoverTrigger asChild>
              <button
                data-office-hover
                aria-label="新建 Office 文档"
                className="shrink-0 px-3 text-stone-600 hover:text-stone-900"
              >
                <Plus size={16} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-48 p-1"
            >
              {kinds.map(({ type, label, Icon, color }) => (
                <button
                  key={type}
                  data-office-hover
                  onClick={() => add(undefined, type)}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs hover:bg-stone-100"
                >
                  <Icon
                    size={16}
                    color={color}
                  />
                  新建 {label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
        <button
          data-office-hover
          className="ml-auto flex shrink-0 items-center gap-2 px-4 text-xs hover:bg-stone-100"
          onClick={() => {
            void requestHost<{ token: string; name: string; bytes: Uint8Array } | null>({ type: "office:pick" })
              .then((result) => {
                if (result) add(new File([result.bytes as BlobPart], result.name), undefined, result.token)
              })
              .catch((error) => setMessage(String(error)))
          }}
        >
          <FolderOpen size={15} />
          打开文件
        </button>
      </div>
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-4 text-xs">
        <span className="truncate">
          本地文档 / {selected?.name || "ONLYOFFICE"}
          {selected?.dirty ? " · 未保存" : ""}
        </span>
        <div className="flex items-center gap-4">
          {selected && (
            <button
              disabled={!!converting || selected.status === "正在加载…"}
              className="flex items-center gap-1 rounded px-2 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-50"
              onClick={() => {
                setMessage("")
                setConverting(selected.id)
                if (isPdf(selected.name)) {
                  void selected
                    .file!.arrayBuffer()
                    .then((bytes) => requestHost<{ saved: boolean; path?: string }>({ type: "office:convert-markdown", name: selected.name, bytes: new Uint8Array(bytes) }))
                    .then((result) => (result.saved ? toast.success("Markdown 已保存", { description: result.path }) : toast.info("已取消保存 Markdown")))
                    .catch((error) => setMessage(String(error)))
                    .finally(() => setConverting(""))
                } else frames.current.get(selected.id)?.contentWindow?.postMessage({ type: "office:export", action: "markdown", format: /\.(xlsx?|ods|csv)$/i.test(selected.name) ? "XLSX" : /\.(pptx?|odp)$/i.test(selected.name) ? "PPTX" : "DOCX" }, location.origin)
              }}
            >
              <FileDown size={13} />
              {converting === selected.id ? "正在转换…" : "转为 Markdown"}
            </button>
          )}
          {selected && (
            <Popover
              open={renameName !== null}
              onOpenChange={(open) => setRenameName(open ? selected.name : null)}
            >
              <PopoverTrigger asChild>
                <button className="text-stone-500 hover:text-green-700">重命名</button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3">
                <form
                  className="flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (!renameName) return
                    void requestHost<string>({ type: "office:rename", token: selected.token, name: renameName })
                      .then((name) => {
                        setDocs((items) => items.map((doc) => (doc.id === selected.id ? { ...doc, name } : doc)))
                        setRenameName(null)
                      })
                      .catch((error) => setMessage(String(error)))
                  }}
                >
                  <input
                    aria-label="文档名称"
                    autoFocus
                    className="min-w-0 flex-1 rounded border px-2 text-xs"
                    value={renameName || ""}
                    onChange={(e) => setRenameName(e.target.value)}
                  />
                  <button className="rounded bg-green-700 px-2 py-1 text-xs text-white">确定</button>
                </form>
              </PopoverContent>
            </Popover>
          )}
          {selected && !isPdf(selected.name) && (
            <button
              disabled={!!converting}
              className="flex items-center gap-1 rounded bg-green-700 px-3 py-1.5 text-white hover:bg-green-800 disabled:opacity-50"
              onClick={() => frames.current.get(selected.id)?.contentWindow?.postMessage({ type: "office:export", format: selected.name.match(/\.(xlsx?|ods|csv)$/i) ? "XLSX" : selected.name.match(/\.(pptx?|odp)$/i) ? "PPTX" : "DOCX" }, location.origin)}
            >
              <Save size={13} />
              保存
            </button>
          )}
        </div>
      </div>
      <Toaster theme={dark ? "dark" : "light"} />
      {message && (
        <div
          role="alert"
          className="flex justify-between bg-red-50 px-4 py-2 text-xs text-red-600"
        >
          {message}
          <button onClick={() => setMessage("")}>关闭</button>
        </div>
      )}
      {selected?.status && !["本地编辑", "已保存", "正在加载…", "PDF 预览"].includes(selected.status) && (
        <p
          role="alert"
          className="px-4 text-xs text-red-600"
        >
          {selected.status}
        </p>
      )}
      <div className="relative min-h-0 flex-1">
        {docs.map((doc) =>
          isPdf(doc.name) ? (
            <PdfPane
              key={doc.id}
              doc={doc}
              hidden={doc.id !== active}
            />
          ) : (
            <iframe
              key={doc.id}
              ref={(frame) => {
                if (frame) frames.current.set(doc.id, frame)
                else frames.current.delete(doc.id)
              }}
              hidden={doc.id !== active}
              data-title={doc.name} aria-label={doc.name}
              src="/office.html?editor=1"
              className="absolute inset-0 h-full w-full border-0"
            />
          )
        )}
        {!docs.length && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-stone-500">
            <FileText
              size={40}
              className="text-green-600"
            />
            <h1 className="text-xl font-semibold text-stone-800">ONLYOFFICE</h1>
            <p className="text-sm">打开本地 Office 或 PDF 文件，或点击上方 ＋ 新建 Word、Excel、PPT。</p>
          </div>
        )}
      </div>
    </div>
  )
}
