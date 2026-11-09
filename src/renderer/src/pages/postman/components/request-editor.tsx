import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup } from "@/components/ui/radio-group"
import { ApiRadio } from "@/pages/postman/components/api-controls"
import { ApiCodeEditor } from "@/pages/postman/components/code-editor"
import { KVTable } from "@/pages/postman/components/kv-table"
import { VarInput } from "@/pages/postman/components/var-input"
import { METHOD_COLOR, METHODS, type AuthConfig, type BodyType, type RawType, type RequestDraft } from "@/pages/postman/lib/model"
import { parseCurl } from "@/pages/postman/lib/curl"
import { paramsFromUrl, urlWithParams } from "@/pages/postman/lib/url-params"
import { Code2, Loader2, Save, Send, Wand2 } from "lucide-react"
import { useState, type ReactNode } from "react"

type RequestTabId = "params" | "headers" | "auth" | "body" | "pre" | "tests"

const PRE_SNIPPETS: [string, string][] = [
  ["设置环境变量", 'pm.environment.set("key", "value")'],
  ["读取环境变量", 'const value = pm.environment.get("key")'],
  ["添加请求头", 'pm.request.headers.add({ key: "X-Request-Id", value: Date.now().toString() })'],
  ["生成时间戳", 'pm.environment.set("timestamp", Date.now().toString())'],
  ["打印日志", 'console.log(pm.request.url)']
]

const TEST_SNIPPETS: [string, string][] = [
  ["状态码为 200", 'pm.test("Status code is 200", () => {\n  pm.response.to.have.status(200)\n})'],
  ["响应时间小于 500ms", 'pm.test("Response time is less than 500ms", () => {\n  pm.expect(pm.response.responseTime).to.be.below(500)\n})'],
  ["JSON 字段值校验", 'pm.test("Check JSON value", () => {\n  const json = pm.response.json()\n  pm.expect(json.id).to.eql(1)\n})'],
  ["响应体包含文本", 'pm.test("Body contains string", () => {\n  pm.expect(pm.response.text()).to.include("ok")\n})'],
  ["存在响应头", 'pm.test("Content-Type is present", () => {\n  pm.response.to.have.header("Content-Type")\n})'],
  ["从响应保存变量", 'const json = pm.response.json()\npm.environment.set("token", json.token)']
]

/** Script editor with a Postman-like snippet list on the side. */
function ScriptPane({ value, onChange, snippets, hint }: { value: string; onChange: (value: string) => void; snippets: [string, string][]; hint: string }) {
  return (
    <div className="flex min-h-0 flex-1 gap-3">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-stone-200">
        <ApiCodeEditor value={value} onChange={onChange} language="javascript" ariaLabel={hint} />
      </div>
      <aside className="w-44 shrink-0 space-y-1 overflow-y-auto">
        <p className="text-[11px] leading-relaxed text-stone-400">{hint}</p>
        <p className="pt-1 text-[11px] font-semibold text-stone-500">代码片段</p>
        {snippets.map(([label, code]) => (
          <button key={label} type="button" className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-amber-700 hover:bg-amber-50" onClick={() => onChange(value.trim() ? `${value.replace(/\s+$/, "")}\n\n${code}\n` : `${code}\n`)}>
            {label}
          </button>
        ))}
      </aside>
    </div>
  )
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-1">
    <span className="block text-[11px] font-medium text-stone-500">{label}</span>
    {children}
  </label>
)

const inputClass = "h-8 w-full rounded border border-stone-200 px-2.5 font-mono text-xs outline-none focus:border-amber-500"

/** URL bar plus the Params / Headers / Auth / Body / Pre-request / Tests editors of one request tab. */
export function RequestEditor({ draft, onChange, vars, loading, dirty, onSend, onSave, onCode }: { draft: RequestDraft; onChange: (patch: Partial<RequestDraft>) => void; vars: Record<string, string>; loading: boolean; dirty: boolean; onSend: () => void; onSave: () => void; onCode: () => void }) {
  const [tab, setTab] = useState<RequestTabId>("params")
  const auth = (patch: Partial<AuthConfig>) => onChange({ auth: { ...draft.auth, ...patch } })
  const count = (rows: { key: string; enabled: boolean }[]) => rows.filter((row) => row.enabled && row.key).length
  const tabs: { id: RequestTabId; label: string; badge?: string | number }[] = [
    { id: "params", label: "Params", badge: count(draft.params) || undefined },
    { id: "headers", label: "Headers", badge: count(draft.headers) || undefined },
    { id: "auth", label: "Auth", badge: draft.authType !== "none" ? "•" : undefined },
    { id: "body", label: "Body", badge: draft.bodyType !== "none" ? "•" : undefined },
    { id: "pre", label: "Pre-request", badge: draft.preRequest.trim() ? "•" : undefined },
    { id: "tests", label: "Tests", badge: draft.tests.trim() ? "•" : undefined }
  ]
  const formatJson = () => {
    try {
      onChange({ bodyRaw: JSON.stringify(JSON.parse(draft.bodyRaw), null, 2) })
    } catch {
      /* leave invalid JSON untouched */
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-stone-200 bg-white p-3">
        <div className="flex min-w-0 flex-1 items-center rounded-md border border-stone-200 focus-within:border-amber-500">
          <Select value={draft.method} onValueChange={(method) => onChange({ method })}>
            <SelectTrigger className={`api-select-trigger api-method-trigger h-9 w-28 shrink-0 rounded-r-none border-0 border-r bg-stone-50 text-xs font-bold ${METHOD_COLOR[draft.method] ?? ""}`} aria-label="请求方法"><SelectValue /></SelectTrigger>
            <SelectContent className="api-select-content">
              {METHODS.map((method) => <SelectItem key={method} value={method} className={`font-bold ${METHOD_COLOR[method]}`}>{method}</SelectItem>)}
            </SelectContent>
          </Select>
          <VarInput
            aria-label="请求 URL"
            value={draft.url}
            vars={vars}
            placeholder="输入 URL 或粘贴 cURL，例如 {{baseUrl}}/api/v1/users"
            onValueChange={(url) => {
              if (/^\s*curl\s/i.test(url)) {
                try {
                  const parsed = parseCurl(url)
                  onChange({ ...parsed, savedId: draft.savedId, collectionId: draft.collectionId, name: draft.savedId ? draft.name : parsed.name })
                  return
                } catch {
                  /* not a complete cURL command yet; keep it as plain text */
                }
              }
              onChange({ url, params: paramsFromUrl(url, draft.params) })
            }}
            wrapperClassName="flex-1"
            className="h-9 px-3 font-mono text-xs outline-none"
          />
        </div>
        <Button onClick={onSend} disabled={loading} className="h-9 gap-1.5 bg-amber-500 px-4 text-xs font-semibold text-white hover:bg-amber-600" data-title="发送 (⌘/Ctrl + Enter)">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {loading ? "发送中…" : "发送"}
        </Button>
        <Button variant="outline" onClick={onSave} className="api-save-button relative h-9 gap-1.5 border-stone-200 px-3 text-xs" data-title="保存 (⌘/Ctrl + S)">
          <Save className="size-3.5" />保存
          {dirty && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-amber-500" aria-label="有未保存的修改" />}
        </Button>
        <Button variant="outline" onClick={onCode} className="h-9 border-stone-200 px-2.5 text-xs" aria-label="生成代码" data-title="生成代码片段">
          <Code2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex shrink-0 border-b border-stone-200 bg-stone-50/50 px-3 text-xs" role="tablist" aria-label="请求配置">
        {tabs.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-1 px-3 py-2 transition-colors ${tab === item.id ? "border-b-2 border-amber-600 bg-white font-semibold text-amber-700" : "text-stone-600 hover:text-stone-900"}`}>
            {item.label}
            {item.badge !== undefined && <span className={typeof item.badge === "number" ? "text-[10px] text-green-600" : "text-green-600"}>{typeof item.badge === "number" ? `(${item.badge})` : item.badge}</span>}
          </button>
        ))}
      </div>

      <div className={`min-h-0 flex-1 bg-white p-3 text-xs ${tab === "body" || tab === "pre" || tab === "tests" ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
        {tab === "params" && <KVTable title="Query Params（与 URL 实时同步）" rows={draft.params} vars={vars} keyPlaceholder="参数名" valuePlaceholder="参数值" onChange={(params) => onChange({ params, url: urlWithParams(draft.url, params) })} />}
        {tab === "headers" && <KVTable title="Headers" rows={draft.headers} vars={vars} keyPlaceholder="请求头" valuePlaceholder="值" onChange={(headers) => onChange({ headers })} />}
        {tab === "auth" && (
          <div className="max-w-xl space-y-3">
            <Field label="认证类型">
              <Select value={draft.authType} onValueChange={(authType) => onChange({ authType: authType as RequestDraft["authType"] })}>
                <SelectTrigger className="api-select-trigger h-8 w-48 text-xs" aria-label="认证类型"><SelectValue /></SelectTrigger>
                <SelectContent className="api-select-content">
                  <SelectItem value="none">No Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="apiKey">API Key</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.authType === "none" && <p className="text-stone-400">此请求不使用认证。</p>}
            {draft.authType === "bearer" && <Field label="Token"><VarInput value={draft.auth.token} vars={vars} onValueChange={(token) => auth({ token })} placeholder="{{token}}" className={inputClass} /></Field>}
            {draft.authType === "basic" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Username"><VarInput value={draft.auth.username} vars={vars} onValueChange={(username) => auth({ username })} className={inputClass} /></Field>
                <Field label="Password"><input type="password" value={draft.auth.password} onChange={(event) => auth({ password: event.target.value })} className={inputClass} /></Field>
              </div>
            )}
            {draft.authType === "apiKey" && (
              <div className="grid grid-cols-[1fr_1fr_8rem] gap-3">
                <Field label="Key"><VarInput value={draft.auth.apiKeyName} vars={vars} onValueChange={(apiKeyName) => auth({ apiKeyName })} placeholder="X-API-Key" className={inputClass} /></Field>
                <Field label="Value"><VarInput value={draft.auth.apiKeyValue} vars={vars} onValueChange={(apiKeyValue) => auth({ apiKeyValue })} className={inputClass} /></Field>
                <Field label="添加到">
                  <Select value={draft.auth.apiKeyLocation} onValueChange={(apiKeyLocation) => auth({ apiKeyLocation: apiKeyLocation as AuthConfig["apiKeyLocation"] })}>
                    <SelectTrigger className="api-select-trigger h-8 text-xs" aria-label="API Key 位置"><SelectValue /></SelectTrigger>
                    <SelectContent className="api-select-content">
                      <SelectItem value="header">Header</SelectItem>
                      <SelectItem value="query">Query Params</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}
          </div>
        )}
        {tab === "body" && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex shrink-0 flex-wrap items-center gap-4">
              <RadioGroup value={draft.bodyType} onValueChange={(value) => onChange({ bodyType: value as BodyType })} aria-label="Body 类型" className="flex flex-wrap items-center gap-4">
                {(["none", "form-data", "x-www-form-urlencoded", "raw"] as BodyType[]).map((type) => (
                  <label key={type} className="flex cursor-pointer items-center gap-1.5">
                    <ApiRadio value={type} aria-label={type} />
                    <span>{type}</span>
                  </label>
                ))}
              </RadioGroup>
              {draft.bodyType === "raw" && (
                <div className="ml-auto flex items-center gap-2">
                  {draft.rawType === "json" && <button type="button" className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-amber-700 hover:bg-amber-50" onClick={formatJson}><Wand2 className="size-3" />美化 JSON</button>}
                  <Select value={draft.rawType} onValueChange={(rawType) => onChange({ rawType: rawType as RawType })}>
                    <SelectTrigger className="api-select-trigger h-7 w-28 text-xs" aria-label="Raw 类型"><SelectValue /></SelectTrigger>
                    <SelectContent className="api-select-content">
                      {(["json", "text", "javascript", "html", "xml"] as RawType[]).map((type) => <SelectItem key={type} value={type}>{type === "json" ? "JSON" : type === "text" ? "Text" : type === "javascript" ? "JavaScript" : type.toUpperCase()}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {draft.bodyType === "none" && <div className="flex flex-1 items-center justify-center text-stone-400">此请求没有 Body</div>}
            {draft.bodyType === "raw" && (
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-stone-200">
                <ApiCodeEditor value={draft.bodyRaw} onChange={(bodyRaw) => onChange({ bodyRaw })} language={draft.rawType === "text" ? "plaintext" : draft.rawType} ariaLabel="请求 Body" />
              </div>
            )}
            {(draft.bodyType === "form-data" || draft.bodyType === "x-www-form-urlencoded") && (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <KVTable rows={draft.bodyForm} vars={vars} keyPlaceholder="字段" valuePlaceholder="值" onChange={(bodyForm) => onChange({ bodyForm })} />
              </div>
            )}
          </div>
        )}
        {tab === "pre" && <ScriptPane value={draft.preRequest} onChange={(preRequest) => onChange({ preRequest })} snippets={PRE_SNIPPETS} hint="在请求发送前执行，可用 pm.environment.set 设置变量、pm.request 修改请求。" />}
        {tab === "tests" && <ScriptPane value={draft.tests} onChange={(tests) => onChange({ tests })} snippets={TEST_SNIPPETS} hint="在收到响应后执行，用 pm.test / pm.expect 编写断言，可把响应数据写入环境变量。" />}
      </div>
    </div>
  )
}
