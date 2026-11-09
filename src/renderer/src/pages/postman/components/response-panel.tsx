import { toast } from "@/components/ui/sonner"
import { ApiCodeEditor } from "@/pages/postman/components/code-editor"
import type { ApiResponseData } from "@vessel/type"
import { Check, Cookie, Copy, Download, Loader2, Search, WrapText } from "lucide-react"
import { useMemo, useRef, useState } from "react"
import type { editor } from "monaco-editor"

type ResponseTab = "body" | "cookies" | "headers" | "tests" | "console"
type ViewMode = "pretty" | "raw" | "preview"

const header = (response: ApiResponseData, name: string) => Object.entries(response.headers).find(([key]) => key.toLowerCase() === name)?.[1] ?? ""

/** Picks the Monaco language and pretty-printed text for a response body. */
function present(response: ApiResponseData) {
  const type = (response.contentType || header(response, "content-type")).toLowerCase()
  try {
    return { language: "json", pretty: JSON.stringify(JSON.parse(response.body), null, 2), type }
  } catch {
    const language = type.includes("html") ? "html" : type.includes("xml") ? "xml" : type.includes("javascript") ? "javascript" : type.includes("css") ? "css" : "plaintext"
    return { language, pretty: response.body, type }
  }
}

const extension = (type: string, language: string) => (type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpg" : type.includes("gif") ? "gif" : type.includes("svg") ? "svg" : type.includes("webp") ? "webp" : type.includes("pdf") ? "pdf" : language === "json" ? "json" : language === "html" ? "html" : language === "xml" ? "xml" : "txt")

/** Parses Set-Cookie headers for display. */
function cookieRows(response: ApiResponseData) {
  return response.cookies.map((raw) => {
    const [pair, ...attributes] = raw.split(";")
    const index = pair.indexOf("=")
    const attr = (name: string) => attributes.map((item) => item.trim()).find((item) => item.toLowerCase().startsWith(name))
    return {
      name: pair.slice(0, index).trim(),
      value: pair.slice(index + 1).trim(),
      domain: attr("domain=")?.slice(7) ?? "",
      path: attr("path=")?.slice(5) ?? "/",
      expires: attr("expires=")?.slice(8) ?? (attr("max-age=") ? `${attr("max-age=")!.slice(8)}s` : "Session"),
      httpOnly: !!attr("httponly"),
      secure: !!attr("secure")
    }
  })
}

const statusTone = (status: number) => (status >= 200 && status < 300 ? "bg-green-100 text-green-700" : status >= 300 && status < 400 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")
const formatSize = (bytes: number) => (bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(2)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`)

/** Response viewer: Pretty / Raw / Preview body, cookies, headers, test results and script console. */
export function ResponsePanel({ response, loading, onManageCookies }: { response: ApiResponseData | null; loading: boolean; onManageCookies: () => void }) {
  const [tab, setTab] = useState<ResponseTab>("body")
  const [mode, setMode] = useState<ViewMode>("pretty")
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const view = useMemo(() => (response ? present(response) : null), [response])
  const binary = response?.bodyEncoding === "base64"
  const image = binary && view?.type.startsWith("image/")
  const passed = response?.testResults.filter((item) => item.passed).length ?? 0

  const copy = () => {
    if (!response) return
    void navigator.clipboard.writeText(mode === "pretty" && view ? view.pretty : response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const save = () => {
    if (!response || !view) return
    void window.electronAPI.apiClient
      .saveFile(`response.${extension(view.type, view.language)}`, binary ? response.body : mode === "pretty" ? view.pretty : response.body, binary ? "base64" : "text")
      .then((saved) => saved && toast.success("响应已保存"))
      .catch((error) => toast.error(`保存失败：${String(error)}`))
  }

  if (!response) {
    return (
      <div className="flex min-h-0 flex-1 flex-col bg-stone-50/30">
        <div className="flex h-9 shrink-0 items-center border-b border-stone-200 bg-stone-100/70 px-3 text-xs font-semibold text-stone-500">响应 Response</div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-white text-xs text-stone-400">
          {loading ? <><Loader2 className="size-5 animate-spin text-amber-500" />正在发送请求…</> : <>点击“发送”或按 ⌘/Ctrl + Enter 发起请求</>}
        </div>
      </div>
    )
  }

  const tabs: { id: ResponseTab; label: string }[] = [
    { id: "body", label: "Body" },
    { id: "cookies", label: `Cookies${response.cookies.length ? ` (${response.cookies.length})` : ""}` },
    { id: "headers", label: `Headers (${Object.keys(response.headers).length})` },
    { id: "tests", label: `Tests${response.testResults.length ? ` (${passed}/${response.testResults.length})` : ""}` },
    { id: "console", label: `控制台${response.logs?.length ? ` (${response.logs.length})` : ""}` }
  ]
  const iconButton = "flex size-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-stone-50/30">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-stone-200 bg-stone-100/70 px-3 text-xs">
        <div className="flex min-w-0 items-center gap-1" role="tablist" aria-label="响应">
          {tabs.map((item) => (
            <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium ${tab === item.id ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-[11px]">
          {loading && <Loader2 className="size-3.5 animate-spin text-amber-500" />}
          <span className={`rounded px-1.5 py-0.5 font-bold ${statusTone(response.status)}`}>{response.status || "ERR"} {response.statusText}</span>
          <span className="text-stone-500">{response.durationMs} ms</span>
          <span className="text-stone-500">{formatSize(response.sizeBytes)}</span>
        </div>
      </div>

      {tab === "body" && (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-3 text-[11px]">
          <div className="flex rounded-md bg-stone-100 p-0.5">
            {(["pretty", "raw", "preview"] as ViewMode[]).map((item) => (
              <button key={item} type="button" onClick={() => setMode(item)} className={`rounded px-2 py-0.5 font-medium ${mode === item ? "bg-white text-amber-700 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}>
                {item === "pretty" ? "Pretty" : item === "raw" ? "Raw" : "Preview"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-0.5">
            {mode !== "preview" && !binary && <>
              <button type="button" className={iconButton} aria-label="搜索响应" data-title="搜索 (⌘/Ctrl + F)" onClick={() => void editorRef.current?.getAction("actions.find")?.run()}><Search className="size-3.5" /></button>
              <button type="button" className={`${iconButton} ${wrap ? "!text-amber-600" : ""}`} aria-label="自动换行" data-title="自动换行" onClick={() => setWrap(!wrap)}><WrapText className="size-3.5" /></button>
            </>}
            {!binary && <button type="button" className={iconButton} aria-label="复制响应" data-title="复制响应" onClick={copy}>{copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}</button>}
            <button type="button" className={iconButton} aria-label="保存响应到文件" data-title="保存响应到文件" onClick={save}><Download className="size-3.5" /></button>
          </div>
        </div>
      )}

      <div className={`min-h-0 flex-1 bg-white text-xs ${tab === "body" ? "overflow-hidden" : "overflow-auto p-3"}`}>
        {tab === "body" && view && (
          binary ? (
            image ? <div className="grid h-full place-items-center overflow-auto bg-[repeating-conic-gradient(#f5f5f4_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-4"><img src={`data:${view.type.split(";")[0]};base64,${response.body}`} alt="响应图片" className="max-h-full max-w-full object-contain shadow" /></div>
              : <div className="grid h-full place-items-center text-stone-400">二进制内容（{view.type || "未知类型"}，{formatSize(response.sizeBytes)}），可点击右上角保存到文件</div>
          ) : mode === "preview" ? (
            view.language === "html" ? <iframe title="响应预览" sandbox="" srcDoc={response.body} className="size-full border-0 bg-white" />
              : <pre className="h-full overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-stone-700">{view.pretty}</pre>
          ) : (
            <ApiCodeEditor key={mode} value={mode === "pretty" ? view.pretty : response.body} language={mode === "pretty" ? view.language : "plaintext"} readOnly ariaLabel="响应内容" wordWrap={wrap} onMount={(instance) => { editorRef.current = instance }} />
          )
        )}
        {tab === "cookies" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-600">本次响应设置的 Cookie</span>
              <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50" onClick={onManageCookies}><Cookie className="size-3" />管理 Cookies</button>
            </div>
            {response.cookies.length === 0 ? <p className="text-stone-400">响应未设置 Cookie</p> : (
              <table className="w-full table-fixed border-collapse text-left">
                <thead className="text-[11px] text-stone-500"><tr>{["名称", "值", "Domain", "Path", "过期", "HttpOnly", "Secure"].map((item) => <th key={item} className="border-b border-stone-200 px-2 py-1 font-semibold">{item}</th>)}</tr></thead>
                <tbody className="font-mono">{cookieRows(response).map((row, index) => <tr key={index} className="border-b border-stone-100"><td className="truncate px-2 py-1">{row.name}</td><td className="truncate px-2 py-1" title={row.value}>{row.value}</td><td className="truncate px-2 py-1">{row.domain || "（当前域名）"}</td><td className="px-2 py-1">{row.path}</td><td className="truncate px-2 py-1">{row.expires}</td><td className="px-2 py-1">{row.httpOnly ? "✓" : ""}</td><td className="px-2 py-1">{row.secure ? "✓" : ""}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        )}
        {tab === "headers" && (
          <div className="divide-y divide-stone-100">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex gap-3 py-1">
                <span className="w-48 shrink-0 truncate font-semibold text-stone-600" title={key}>{key}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-stone-800">{value}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "tests" && (
          response.testResults.length === 0 ? <p className="text-stone-400">没有测试结果。在请求的 Tests 中使用 pm.test 编写断言。</p> : (
            <div className="space-y-1.5">
              <div className="font-semibold text-stone-700">通过 {passed} / 总计 {response.testResults.length}</div>
              {response.testResults.map((item, index) => (
                <div key={index} className={`flex items-start gap-2 rounded p-2 ${item.passed ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  <span className="w-9 shrink-0 font-bold">{item.passed ? "PASS" : "FAIL"}</span>
                  <div className="min-w-0"><div>{item.name}</div>{item.error && <div className="mt-0.5 break-all text-[11px] text-red-600">{item.error}</div>}</div>
                </div>
              ))}
            </div>
          )
        )}
        {tab === "console" && (
          <div className="space-y-3 font-mono text-[11px]">
            {response.request && (
              <div className="space-y-0.5 rounded border border-stone-200 p-2">
                <div className="font-semibold text-stone-700">{response.request.method} {response.request.url}</div>
                {Object.entries(response.request.headers).map(([key, value]) => <div key={key} className="break-all text-stone-500">{key}: {value}</div>)}
              </div>
            )}
            {response.envUpdates && Object.keys(response.envUpdates).length > 0 && (
              <div className="space-y-0.5 rounded border border-stone-200 p-2">
                <div className="font-sans font-semibold text-stone-600">脚本更新的变量</div>
                {Object.entries(response.envUpdates).map(([key, value]) => <div key={key} className="break-all text-stone-600">{key} = {value === null ? "（已删除）" : value}</div>)}
              </div>
            )}
            {(response.logs ?? []).length === 0 ? <p className="font-sans text-stone-400">脚本中的 console.log 输出会显示在这里</p> : response.logs!.map((line, index) => <div key={index} className={`whitespace-pre-wrap break-all ${line.startsWith("[error]") ? "text-red-600" : line.startsWith("[warn]") ? "text-amber-600" : "text-stone-700"}`}>{line}</div>)}
          </div>
        )}
      </div>
    </div>
  )
}
