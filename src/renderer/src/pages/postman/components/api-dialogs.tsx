import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "@/components/ui/sonner"
import { ApiDialog, primaryButton, secondaryButton } from "@/pages/postman/components/api-dialog"
import { ApiCheckbox } from "@/pages/postman/components/api-controls"
import { ApiCodeEditor } from "@/pages/postman/components/code-editor"
import { KVTable } from "@/pages/postman/components/kv-table"
import { generateSnippet, normalizeRequest, SNIPPET_LANGUAGES, type SnippetLanguage } from "@/pages/postman/lib/codegen"
import { parseCurl } from "@/pages/postman/lib/curl"
import { envRows, type KV, type RequestDraft } from "@/pages/postman/lib/model"
import { importPostman } from "@/pages/postman/lib/postman-collection"
import type { ApiCollectionRecord, ApiCookieRecord, ApiEnvironmentRecord, ApiRunResult } from "@vessel/type"
import { Check, Code2, Cookie, Copy, FileUp, Globe, Play, Save, Trash2, Upload } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")
const ErrorNote = ({ message }: { message: string }) => (message ? <p role="alert" className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{message}</p> : null)

/** Collections flattened into an indented list for location pickers. */
function folderOptions(collections: ApiCollectionRecord[]) {
  const out: { id: string; label: string; depth: number }[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const item of [...collections].filter((entry) => entry.parentId === parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
      out.push({ id: item.id, label: item.name, depth })
      walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

/** Create / edit an environment's name and variables. */
export function EnvironmentDialog({ environment, onClose, onChanged }: { environment: ApiEnvironmentRecord | null; onClose: () => void; onChanged: (list: ApiEnvironmentRecord[], activeId?: string | null) => void }) {
  const [name, setName] = useState(environment?.name ?? "新环境")
  const [rows, setRows] = useState<KV[]>(() => (environment ? envRows(environment) : [{ key: "baseUrl", value: "https://api.example.com", enabled: true }]))
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")
  const api = window.electronAPI.apiClient
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError("")
    try { await action() } catch (reason) { setError(errorText(reason)) } finally { setBusy(false) }
  }
  const save = () => run(async () => {
    if (!name.trim()) throw new Error("请输入环境名称")
    const id = environment?.id ?? `env-${crypto.randomUUID()}`
    onChanged(await api.saveEnvironment({ id, name: name.trim(), variables: JSON.stringify(rows.filter((row) => row.key || row.value)), isActive: environment?.isActive ?? false }))
    toast.success("环境已保存")
    onClose()
  })
  return (
    <ApiDialog onClose={onClose} icon={Globe} title={environment ? "编辑环境" : "新建环境"} description="在请求中用 {{变量名}} 引用，脚本可通过 pm.environment 读写" className="max-w-[640px]" onSubmit={() => void save()} footer={<>
      {environment && <Button type="button" variant="outline" size="sm" className={`${secondaryButton} mr-auto ${confirmDelete ? "border-red-300 text-red-600" : ""}`} disabled={busy} onClick={() => {
        if (!confirmDelete) { setConfirmDelete(true); return }
        void run(async () => { onChanged(await api.deleteEnvironment(environment.id), environment.isActive ? null : undefined); onClose() })
      }}><Trash2 className="size-3.5" />{confirmDelete ? "确认删除？" : "删除"}</Button>}
      {environment && <Button type="button" variant="outline" size="sm" className={secondaryButton} disabled={busy} onClick={() => void run(async () => {
        onChanged(await api.saveEnvironment({ id: `env-${crypto.randomUUID()}`, name: `${name.trim() || environment.name} 副本`, variables: JSON.stringify(rows), isActive: false }))
        toast.success("已复制环境")
        onClose()
      })}><Copy className="size-3.5" />复制</Button>}
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose} disabled={busy}>取消</Button>
      <Button type="submit" size="sm" className={primaryButton} disabled={busy}>保存</Button>
    </>}>
      <label className="mb-3 grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
        <span className="text-right text-muted-foreground">名称</span>
        <Input autoFocus={!environment} value={name} onChange={(event) => setName(event.target.value)} className="h-8 text-xs md:text-xs" />
      </label>
      <KVTable title="变量" rows={rows} vars={{}} keyPlaceholder="变量名" valuePlaceholder="值" onChange={setRows} />
      <ErrorNote message={error} />
    </ApiDialog>
  )
}

/** Save an unsaved request into a collection / folder. */
export function SaveRequestDialog({ draft, collections, onClose, onSave }: { draft: RequestDraft; collections: ApiCollectionRecord[]; onClose: () => void; onSave: (name: string, collectionId: string) => Promise<void> }) {
  const options = useMemo(() => folderOptions(collections), [collections])
  const [name, setName] = useState(draft.name === "新请求" && draft.url ? draft.url.replace(/^https?:\/\//, "").replace(/^\{\{[^}]+\}\}/, "").slice(0, 60) || draft.name : draft.name)
  const [target, setTarget] = useState(draft.collectionId && options.some((item) => item.id === draft.collectionId) ? draft.collectionId : (options[0]?.id ?? "__new__"))
  const [newCollection, setNewCollection] = useState("我的集合")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const submit = async () => {
    if (!name.trim() || busy) return
    setBusy(true)
    setError("")
    try {
      let collectionId = target
      if (target === "__new__") {
        if (!newCollection.trim()) throw new Error("请输入集合名称")
        collectionId = `col-${crypto.randomUUID()}`
        await window.electronAPI.apiClient.saveCollection({ id: collectionId, name: newCollection.trim(), parentId: null })
      }
      await onSave(name.trim(), collectionId)
      onClose()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <ApiDialog onClose={onClose} icon={Save} title="保存请求" description="选择要保存到的集合或文件夹" onSubmit={() => void submit()} footer={<>
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose} disabled={busy}>取消</Button>
      <Button type="submit" size="sm" className={primaryButton} disabled={busy || !name.trim()}>保存</Button>
    </>}>
      <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
        <span className="text-right text-muted-foreground">名称</span>
        <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} onFocus={(event) => event.currentTarget.select()} className="h-8 text-xs md:text-xs" />
        <span className="text-right text-muted-foreground">保存到</span>
        <Select value={target} onValueChange={(value) => { if (value) setTarget(value) }}>
          <SelectTrigger className="api-select-trigger h-8 text-xs" aria-label="保存位置"><SelectValue /></SelectTrigger>
          <SelectContent className="api-select-content max-h-72">
            {options.map((item) => <SelectItem key={item.id} value={item.id}><span style={{ paddingLeft: item.depth * 12 }}>{item.depth ? "└ " : ""}{item.label}</span></SelectItem>)}
            <SelectItem value="__new__">+ 新建集合…</SelectItem>
          </SelectContent>
        </Select>
        {target === "__new__" && <>
          <span className="text-right text-muted-foreground">集合名称</span>
          <Input value={newCollection} onChange={(event) => setNewCollection(event.target.value)} className="h-8 text-xs md:text-xs" />
        </>}
      </div>
      <ErrorNote message={error} />
    </ApiDialog>
  )
}

/** Import a cURL command, a Postman collection (v2/v2.1) or a Postman environment. */
export function ImportDialog({ onClose, onCurl, onImported }: { onClose: () => void; onCurl: (draft: RequestDraft) => void; onImported: (environments?: ApiEnvironmentRecord[]) => Promise<void> }) {
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const api = window.electronAPI.apiClient
  const kind = /^\s*curl\s/i.test(text) ? "cURL 命令" : /^\s*[{[]/.test(text) ? "JSON（Postman 集合 / 环境）" : ""
  const importText = async (source: string) => {
    setBusy(true)
    setError("")
    try {
      if (/^\s*curl\s/i.test(source)) {
        onCurl(parseCurl(source))
        onClose()
        return
      }
      let json: unknown
      try { json = JSON.parse(source) } catch { throw new Error("无法识别：请粘贴 cURL 命令或 Postman 导出的 JSON") }
      const result = importPostman(json)
      if (result.kind === "environment") {
        const list = await api.saveEnvironment({ id: `env-${crypto.randomUUID()}`, name: result.environment.name, variables: JSON.stringify(result.environment.variables), isActive: false })
        await onImported(list)
        toast.success(`已导入环境「${result.environment.name}」`)
      } else {
        await api.importItems(result.payload)
        const list = result.environment ? await api.saveEnvironment({ id: `env-${crypto.randomUUID()}`, name: result.environment.name, variables: JSON.stringify(result.environment.variables), isActive: false }) : undefined
        await onImported(list)
        toast.success(`已导入集合「${result.name}」，共 ${result.count} 个请求${result.environment ? "，集合变量已导入为环境" : ""}`)
      }
      onClose()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      setBusy(false)
    }
  }
  const readFile = (picked: File | undefined) => {
    if (!picked) return
    if (picked.size > 20 * 1024 * 1024) { setError("文件不能超过 20 MB"); return }
    void picked.text().then(importText)
  }
  return (
    <ApiDialog onClose={onClose} icon={Upload} title="导入" description="支持 cURL 命令、Postman Collection v2/v2.1 与 Postman 环境" className="max-w-[560px]" onSubmit={() => void importText(text)} footer={<>
      <span className="mr-auto text-[11px] text-muted-foreground">{kind && `识别为：${kind}`}</span>
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose} disabled={busy}>取消</Button>
      <Button type="submit" size="sm" className={primaryButton} disabled={busy || !text.trim()}>导入</Button>
    </>}>
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); readFile(event.dataTransfer.files[0]) }}
        className={`mb-3 flex items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-4 text-muted-foreground ${dragging ? "border-amber-500 bg-amber-50" : "border-stone-300 dark:border-stone-600"}`}
      >
        <FileUp className="size-4" />
        拖入 JSON 文件，或
        <button type="button" className="font-medium text-amber-600 hover:underline" onClick={() => file.current?.click()}>选择文件</button>
        <input ref={file} type="file" accept=".json,application/json" className="hidden" onChange={(event) => { readFile(event.target.files?.[0]); event.target.value = "" }} />
      </div>
      <textarea aria-label="粘贴内容" autoFocus value={text} onChange={(event) => setText(event.target.value)} spellCheck={false} placeholder={"粘贴 cURL 命令，例如：\ncurl 'https://api.example.com/users' -H 'Authorization: Bearer …'\n\n或粘贴 Postman 导出的 JSON"} className="h-48 w-full resize-none rounded-md border bg-background p-2.5 font-mono text-[11px] outline-none focus:border-amber-500" />
      <ErrorNote message={error} />
    </ApiDialog>
  )
}

/** Generate request code in several languages. */
export function CodeDialog({ draft, vars, onClose }: { draft: RequestDraft; vars: Record<string, string>; onClose: () => void }) {
  const [language, setLanguage] = useState<SnippetLanguage>(() => (localStorage.getItem("vessel-api-snippet") as SnippetLanguage) || "curl")
  const [resolve, setResolve] = useState(true)
  const [copied, setCopied] = useState(false)
  const code = useMemo(() => generateSnippet(language, normalizeRequest(draft, resolve ? vars : {})), [draft, language, resolve, vars])
  useEffect(() => localStorage.setItem("vessel-api-snippet", language), [language])
  return (
    <ApiDialog onClose={onClose} icon={Code2} title="代码片段" description={`${draft.method} ${draft.url || "（未填写 URL）"}`} className="max-w-[720px]" footer={<>
      <label className="mr-auto flex cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground"><ApiCheckbox checked={resolve} onCheckedChange={(checked) => setResolve(checked === true)} />替换环境变量</label>
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose}>关闭</Button>
      <Button type="button" size="sm" className={primaryButton} onClick={() => { void navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "已复制" : "复制"}</Button>
    </>}>
      <div className="mb-2 flex flex-wrap gap-1">
        {SNIPPET_LANGUAGES.map((item) => (
          <button key={item.id} type="button" onClick={() => setLanguage(item.id)} className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${language === item.id ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{item.label}</button>
        ))}
      </div>
      <div className="h-80 overflow-hidden rounded-md border">
        <ApiCodeEditor value={code} language={SNIPPET_LANGUAGES.find((item) => item.id === language)!.editor} readOnly ariaLabel="生成的代码" />
      </div>
    </ApiDialog>
  )
}

/** View and remove cookies stored by the API client's cookie jar. */
export function CookiesDialog({ onClose }: { onClose: () => void }) {
  const [cookies, setCookies] = useState<ApiCookieRecord[] | null>(null)
  const api = window.electronAPI.apiClient
  useEffect(() => { void api.listCookies().then(setCookies).catch((error) => toast.error(errorText(error))) }, [api])
  const remove = (filter?: { domain: string; path?: string; name?: string }) => void api.deleteCookies(filter).then(setCookies).catch((error) => toast.error(errorText(error)))
  const domains = [...new Set((cookies ?? []).map((item) => item.domain))]
  return (
    <ApiDialog onClose={onClose} icon={Cookie} title="Cookies 管理" description="响应中的 Set-Cookie 会自动保存，并在后续匹配的请求中自动携带" className="max-w-[640px]" footer={<>
      {!!cookies?.length && <Button type="button" variant="outline" size="sm" className={`${secondaryButton} mr-auto text-red-600`} onClick={() => remove()}><Trash2 className="size-3.5" />全部清除</Button>}
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose}>关闭</Button>
    </>}>
      {cookies === null ? <p className="text-muted-foreground">加载中…</p> : domains.length === 0 ? <p className="py-6 text-center text-muted-foreground">暂无 Cookie</p> : (
        <div className="space-y-3">
          {domains.map((domain) => (
            <section key={domain} className="overflow-hidden rounded-md border">
              <header className="flex items-center justify-between bg-muted/60 px-2.5 py-1.5">
                <span className="font-mono font-semibold">{domain}</span>
                <button type="button" className="text-[11px] text-red-600 hover:underline" onClick={() => remove({ domain })}>清除该域名</button>
              </header>
              {cookies.filter((item) => item.domain === domain).map((item) => (
                <div key={`${item.path}|${item.name}`} className="group flex items-center gap-2 border-t px-2.5 py-1.5 font-mono text-[11px]">
                  <span className="w-32 shrink-0 truncate font-semibold" title={item.name}>{item.name}</span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={item.value}>{item.value}</span>
                  <span className="shrink-0 text-muted-foreground">{item.path}</span>
                  <span className="w-28 shrink-0 truncate text-muted-foreground">{item.expires ? new Date(item.expires).toLocaleString() : "Session"}</span>
                  <button type="button" aria-label={`删除 ${item.name}`} className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-red-600 group-hover:opacity-100" onClick={() => remove({ domain, path: item.path, name: item.name })}><Trash2 className="size-3" /></button>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </ApiDialog>
  )
}

/** Collection runner results. */
export function RunnerDialog({ name, result, onClose }: { name: string; result: ApiRunResult | null; onClose: () => void }) {
  return (
    <ApiDialog onClose={onClose} icon={Play} title={`运行：${name}`} description={result ? `共 ${result.total} 个请求，通过 ${result.passed}，失败 ${result.failed}` : "正在依次发送请求…"} className="max-w-[640px]" footer={<Button type="button" size="sm" className={primaryButton} onClick={onClose} disabled={!result}>完成</Button>}>
      {!result ? <p className="py-6 text-center text-muted-foreground">运行中…</p> : result.total === 0 ? <p className="py-6 text-center text-muted-foreground">集合中没有请求</p> : (
        <div className="space-y-1.5">
          {result.results.map((item, index) => (
            <details key={index} className={`rounded-md border px-2.5 py-1.5 ${item.passed ? "" : "border-red-200 dark:border-red-900"}`}>
              <summary className="flex cursor-pointer list-none items-center gap-2">
                <span className={`w-9 shrink-0 font-bold ${item.passed ? "text-green-600" : "text-red-600"}`}>{item.passed ? "PASS" : "FAIL"}</span>
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="shrink-0 font-mono text-muted-foreground">{item.status || "ERR"} · {item.durationMs} ms</span>
              </summary>
              <div className="mt-1.5 space-y-0.5 pl-11 text-[11px]">
                <div className="truncate font-mono text-muted-foreground">{item.url}</div>
                {item.testResults.map((test, testIndex) => <div key={testIndex} className={test.passed ? "text-green-700 dark:text-green-400" : "text-red-600"}>{test.passed ? "✓" : "✗"} {test.name}{test.error ? `：${test.error}` : ""}</div>)}
              </div>
            </details>
          ))}
          {Object.keys(result.envUpdates).length > 0 && <p className="pt-1 text-[11px] text-muted-foreground">脚本更新了 {Object.keys(result.envUpdates).length} 个环境变量</p>}
        </div>
      )}
    </ApiDialog>
  )
}
