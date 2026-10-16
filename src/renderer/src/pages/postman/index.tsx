import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import type { ApiCollectionRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord, ApiResponseData } from "@vessel/type"
import { Check, Copy, FolderPlus, Play, Plus, Save, Send, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

/** Renders the postman page component. */
export default function PostmanPage() {
  const navigate = useNavigate()

  /** Handles activity change events. */
  const handleActivityChange = (act: AsideActivity) => {
    if (act === "tools") navigate("/devtools")
    else if (act === "files") navigate("/editor")
    else if (act === "git") navigate("/git")
    else if (act === "postman") navigate("/api-client")
    else navigate(`/${act}`)
  }

  const [sidebarTab, setSidebarTab] = useState<"collections" | "history" | "environments">("collections")

  // 集合与请求
  const [collections, setCollections] = useState<ApiCollectionRecord[]>([])
  const [requests, setRequests] = useState<ApiRequestRecord[]>([])
  const [history, setHistory] = useState<ApiHistoryRecord[]>([])
  const [environments, setEnvironments] = useState<ApiEnvironmentRecord[]>([])
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null)

  // 当前请求状态
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [requestName, setRequestName] = useState("新请求")
  const [method, setMethod] = useState("GET")
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1")
  const [activeReqTab, setActiveReqTab] = useState<"params" | "headers" | "auth" | "body" | "tests">("params")

  // Params / Headers
  const [params, setParams] = useState<{ key: string; value: string; enabled: boolean }[]>([{ key: "", value: "", enabled: true }])
  const [headers, setHeaders] = useState<{ key: string; value: string; enabled: boolean }[]>([{ key: "Accept", value: "application/json", enabled: true }])

  // Auth
  const [authType, setAuthType] = useState<"none" | "bearer" | "basic" | "apiKey">("none")
  const [authToken, setAuthToken] = useState("")
  const [authUsername, setAuthUsername] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [apiKeyName, setApiKeyName] = useState("")
  const [apiKeyValue, setApiKeyValue] = useState("")
  const [apiKeyLocation, setApiKeyLocation] = useState<"header" | "query">("header")

  // Body
  const [bodyType, setBodyType] = useState<"none" | "form-data" | "x-www-form-urlencoded" | "raw">("none")
  const [rawType, setRawType] = useState<"json" | "text" | "html" | "xml" | "javascript">("json")
  const [bodyContent, setBodyContent] = useState("")

  // Tests
  const [testsScript, setTestsScript] = useState(`pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});
pm.test("Response time is less than 1000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(1000);
});`)

  // 响应状态
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState<ApiResponseData | null>(null)
  const [activeResTab, setActiveResTab] = useState<"body" | "headers" | "cookies" | "tests">("body")
  const [copied, setCopied] = useState(false)

  // 初始化加载数据库数据

  /** Loads data. */
  const loadData = useCallback(async () => {
    try {
      const api = window.electronAPI.apiClient
      const [colls, reqs, hist, envs] = await Promise.all([api.listCollections(), api.listRequests(), api.listHistory(100), api.listEnvironments()])
      setCollections(colls)
      setRequests(reqs)
      setHistory(hist)
      setEnvironments(envs)
      const active = envs.find((e) => e.isActive)
      if (active) setActiveEnvId(active.id)
    } catch (e: any) {
      toast.error(`加载数据失败: ${e.message}`)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // 当前环境变量 map
  const activeVars = (() => {
    const env = environments.find((e) => e.id === activeEnvId)
    if (!env) return {}
    try {
      const vars = JSON.parse(env.variables) as { key: string; value: string; enabled: boolean }[]
      const map: Record<string, string> = {}
      vars.forEach((v) => {
        if (v.enabled && v.key) map[v.key] = v.value
      })
      return map
    } catch {
      return {}
    }
  })()

  // 发送请求

  /** Handles send events. */
  const handleSend = async () => {
    if (!url.trim()) {
      toast.error("请输入请求 URL")
      return
    }
    setLoading(true)
    setResponse(null)
    try {
      const res = await window.electronAPI.apiClient.send({
        method,
        url: url.trim(),
        headers: headers.filter((h) => h.key),
        params: params.filter((p) => p.key),
        bodyType,
        bodyContent,
        rawType,
        authType,
        authConfig: {
          token: authToken,
          username: authUsername,
          password: authPassword,
          apiKeyName,
          apiKeyValue,
          apiKeyLocation
        },
        tests: testsScript,
        envVariables: activeVars
      })

      setResponse(res)
      setActiveResTab("body")
      // 刷新历史
      const hist = await window.electronAPI.apiClient.listHistory(100)
      setHistory(hist)
    } catch (err: any) {
      toast.error(`请求失败: ${err.message || String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  // 保存请求

  /** Handles save request events. */
  const handleSaveRequest = async () => {
    try {
      const id = currentRequestId || `req-${Date.now()}`
      await window.electronAPI.apiClient.saveRequest({
        id,
        collectionId: collections[0]?.id || null,
        name: requestName || "未命名请求",
        method,
        url,
        headers: JSON.stringify(headers),
        params: JSON.stringify(params),
        bodyType,
        bodyContent,
        rawType,
        authType,
        authConfig: JSON.stringify({
          token: authToken,
          username: authUsername,
          password: authPassword,
          apiKeyName,
          apiKeyValue,
          apiKeyLocation
        }),
        tests: testsScript,
        updatedAt: Date.now()
      })
      setCurrentRequestId(id)
      const reqs = await window.electronAPI.apiClient.listRequests()
      setRequests(reqs)
      toast.success("请求已保存")
    } catch (e: any) {
      toast.error(`保存失败: ${e.message}`)
    }
  }

  // 加载请求

  /** Loads request. */
  const loadRequest = (req: ApiRequestRecord) => {
    setCurrentRequestId(req.id)
    setRequestName(req.name)
    setMethod(req.method)
    setUrl(req.url)
    try {
      setHeaders(JSON.parse(req.headers))
    } catch {}
    try {
      setParams(JSON.parse(req.params))
    } catch {}
    setBodyType(req.bodyType as any)
    setBodyContent(req.bodyContent)
    if (req.rawType) setRawType(req.rawType)
    setAuthType(req.authType as any)
    try {
      const ac = JSON.parse(req.authConfig)
      setAuthToken(ac.token || "")
      setAuthUsername(ac.username || "")
      setAuthPassword(ac.password || "")
      setApiKeyName(ac.apiKeyName || "")
      setApiKeyValue(ac.apiKeyValue || "")
      setApiKeyLocation(ac.apiKeyLocation || "header")
    } catch {}
    setTestsScript(req.tests || "")
    setResponse(null)
  }

  // 批量运行集合 (Collection Runner)

  /** Handles run collection events. */
  const handleRunCollection = async (collectionId: string) => {
    setLoading(true)
    try {
      const res = await window.electronAPI.apiClient.runCollection(collectionId, activeVars)
      toast.success(`批量运行完成: 成功 ${res.passed} / 失败 ${res.failed}`)
    } catch (e: any) {
      toast.error(`批量运行失败: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 复制响应内容

  /** Handles copy response events. */
  const handleCopyResponse = () => {
    if (!response?.body) return
    void navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
    toast.success("已复制响应体")
  }

  // 格式化后的 JSON 字符串
  const formattedJson = (() => {
    if (!response?.body) return ""
    try {
      return JSON.stringify(JSON.parse(response.body), null, 2)
    } catch {
      return response.body
    }
  })()

  return (
    <Layout
      aside={
        <LayoutActivityBar
          activity="postman"
          onActivityChange={handleActivityChange}
        />
      }
    >
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-800">
        {/* 顶部工具栏 */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50/70 px-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-amber-500 text-white font-bold text-xs">P</div>
            <input
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              className="rounded px-2 py-1 text-sm font-semibold text-stone-800 hover:bg-stone-200/50 outline-none focus:bg-white focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* 环境选择器与保存 */}
          <div className="flex items-center gap-2 text-xs">
            <select
              value={activeEnvId || ""}
              onChange={async (e) => {
                const val = e.target.value || null
                setActiveEnvId(val)
                const updated = await window.electronAPI.apiClient.setActiveEnvironment(val)
                setEnvironments(updated)
              }}
              className="rounded border border-stone-200 bg-white px-2 py-1 text-xs outline-none focus:border-amber-500"
            >
              <option value="">No Environment (无环境)</option>
              {environments.map((env) => (
                <option
                  key={env.id}
                  value={env.id}
                >
                  {env.name}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-stone-200"
              onClick={handleSaveRequest}
            >
              <Save className="size-3.5" />
              <span>保存</span>
            </Button>
          </div>
        </header>

        {/* 主体分栏 */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* 左侧边栏 (Collections / History / Environments) */}
          <aside className="w-64 shrink-0 border-r border-stone-200 bg-stone-50/50 flex flex-col overflow-hidden">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-stone-200 text-xs font-medium">
              <button
                type="button"
                className={`flex-1 py-2 text-center transition-colors ${sidebarTab === "collections" ? "border-b-2 border-amber-600 font-semibold text-amber-700 bg-white" : "text-stone-500 hover:text-stone-800"}`}
                onClick={() => setSidebarTab("collections")}
              >
                集合
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-center transition-colors ${sidebarTab === "history" ? "border-b-2 border-amber-600 font-semibold text-amber-700 bg-white" : "text-stone-500 hover:text-stone-800"}`}
                onClick={() => setSidebarTab("history")}
              >
                历史
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-center transition-colors ${sidebarTab === "environments" ? "border-b-2 border-amber-600 font-semibold text-amber-700 bg-white" : "text-stone-500 hover:text-stone-800"}`}
                onClick={() => setSidebarTab("environments")}
              >
                环境
              </button>
            </div>

            {/* 边栏内容 */}
            <div className="flex-1 overflow-y-auto p-2 text-xs">
              {sidebarTab === "collections" && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-stone-500">我的集合</span>
                    <button
                      type="button"
                      title="新建集合"
                      className="rounded p-1 hover:bg-stone-200"
                      onClick={async () => {
                        const name = prompt("请输入集合名称:")
                        if (!name) return
                        const updated = await window.electronAPI.apiClient.saveCollection({
                          id: `col-${Date.now()}`,
                          name
                        })
                        setCollections(updated)
                      }}
                    >
                      <FolderPlus className="size-3.5" />
                    </button>
                  </div>

                  {collections.map((col) => {
                    const colRequests = requests.filter((r) => r.collectionId === col.id)
                    return (
                      <div
                        key={col.id}
                        className="mb-2"
                      >
                        <div className="flex items-center justify-between rounded px-2 py-1 font-semibold text-stone-700 hover:bg-stone-200/60 group">
                          <span className="truncate flex-1">{col.name}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                            <button
                              type="button"
                              title="批量运行 (Run)"
                              className="p-1 hover:text-green-700"
                              onClick={() => handleRunCollection(col.id)}
                            >
                              <Play className="size-3 text-green-600" />
                            </button>
                            <button
                              type="button"
                              title="删除集合"
                              className="p-1 hover:text-red-700"
                              onClick={async () => {
                                if (!confirm(`确定删除集合 ${col.name} 吗？`)) return
                                const updated = await window.electronAPI.apiClient.deleteCollection(col.id)
                                setCollections(updated)
                              }}
                            >
                              <Trash2 className="size-3 text-stone-400" />
                            </button>
                          </div>
                        </div>

                        {/* 集合下的请求列表 */}
                        <div className="pl-3 space-y-0.5 mt-0.5">
                          {colRequests.map((req) => (
                            <div
                              key={req.id}
                              onClick={() => loadRequest(req)}
                              className={`flex items-center gap-2 rounded px-2 py-1 cursor-pointer truncate ${currentRequestId === req.id ? "bg-amber-100/70 font-medium" : "hover:bg-stone-100"}`}
                            >
                              <span className={`text-[10px] font-bold ${req.method === "GET" ? "text-green-600" : req.method === "POST" ? "text-amber-600" : req.method === "DELETE" ? "text-red-600" : "text-blue-600"}`}>{req.method}</span>
                              <span className="truncate flex-1 text-stone-700">{req.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {sidebarTab === "history" && (
                <div className="space-y-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-stone-500">请求历史</span>
                    <button
                      type="button"
                      className="text-[11px] text-stone-400 hover:text-red-600"
                      onClick={async () => {
                        await window.electronAPI.apiClient.clearHistory()
                        setHistory([])
                      }}
                    >
                      清空
                    </button>
                  </div>
                  {history.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => {
                        setMethod(h.method)
                        setUrl(h.url)
                        try {
                          const opt = JSON.parse(h.requestData)
                          if (opt.headers) setHeaders(opt.headers)
                          if (opt.params) setParams(opt.params)
                          if (opt.bodyContent) setBodyContent(opt.bodyContent)
                        } catch {}
                      }}
                      className="flex flex-col rounded p-1.5 hover:bg-stone-100 cursor-pointer border border-transparent hover:border-stone-200"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`font-bold ${h.method === "GET" ? "text-green-600" : h.method === "POST" ? "text-amber-600" : "text-blue-600"}`}>{h.method}</span>
                        <span className={`font-semibold ${h.status >= 200 && h.status < 300 ? "text-green-600" : h.status === 0 ? "text-red-500" : "text-amber-600"}`}>{h.status || "ERR"}</span>
                      </div>
                      <div
                        className="truncate text-stone-600 font-mono text-[10px]"
                        title={h.url}
                      >
                        {h.url}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sidebarTab === "environments" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold text-stone-500">
                    <span>环境变量</span>
                    <button
                      type="button"
                      title="添加环境"
                      className="p-1 hover:bg-stone-200 rounded"
                      onClick={async () => {
                        const name = prompt("请输入环境名称 (如 Staging):")
                        if (!name) return
                        const updated = await window.electronAPI.apiClient.saveEnvironment({
                          id: `env-${Date.now()}`,
                          name,
                          variables: JSON.stringify([{ key: "baseUrl", value: "https://api.example.com", enabled: true }]),
                          isActive: false
                        })
                        setEnvironments(updated)
                      }}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  {environments.map((env) => (
                    <div
                      key={env.id}
                      className="rounded border border-stone-200 bg-white p-2"
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span>{env.name}</span>
                        <button
                          type="button"
                          className="text-stone-400 hover:text-red-600"
                          onClick={async () => {
                            const updated = await window.electronAPI.apiClient.deleteEnvironment(env.id)
                            setEnvironments(updated)
                          }}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                      <div className="mt-1 text-[10px] text-stone-400">使用例如 {"{{baseUrl}}"} 自动在请求中插值替换</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* 右侧主请求与响应区 */}
          <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* URL 输入栏 */}
            <div className="p-3 border-b border-stone-200 bg-white flex items-center gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="h-9 rounded-md border border-stone-200 bg-stone-50 px-2.5 font-bold text-xs outline-none focus:border-amber-500"
              >
                {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((m) => (
                  <option
                    key={m}
                    value={m}
                  >
                    {m}
                  </option>
                ))}
              </select>

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="输入 URL 或使用 {{baseUrl}}/api/v1/users…"
                className="h-9 flex-1 rounded-md border border-stone-200 px-3 font-mono text-xs outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend()
                }}
              />

              <Button
                onClick={handleSend}
                disabled={loading}
                className="h-9 bg-amber-500 hover:bg-amber-600 text-white gap-1.5 px-4 text-xs font-semibold"
              >
                <Send className="size-3.5" />
                <span>{loading ? "发送中…" : "发送"}</span>
              </Button>
            </div>

            {/* 请求构造区 Tabs */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* 请求配置导航条 */}
              <div className="flex border-b border-stone-200 bg-stone-50/50 px-3 text-xs">
                {[
                  { id: "params", label: `Params ${params.filter((p) => p.key).length ? `(${params.filter((p) => p.key).length})` : ""}` },
                  { id: "headers", label: `Headers (${headers.filter((h) => h.key).length})` },
                  { id: "auth", label: "Auth" },
                  { id: "body", label: `Body ${bodyType !== "none" ? "•" : ""}` },
                  { id: "tests", label: "Tests" }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveReqTab(tab.id as any)}
                    className={`py-2 px-3 transition-colors ${activeReqTab === tab.id ? "border-b-2 border-amber-600 font-semibold text-amber-700 bg-white" : "text-stone-600 hover:text-stone-900"}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 请求配置具体内容 */}
              <div className="h-48 shrink-0 overflow-y-auto p-3 text-xs border-b border-stone-200 bg-white">
                {activeReqTab === "params" && (
                  <div className="space-y-1">
                    <div className="flex items-center text-[11px] font-semibold text-stone-400 mb-1">
                      <span className="w-8">启用</span>
                      <span className="flex-1">参数名 (Key)</span>
                      <span className="flex-1">参数值 (Value)</span>
                    </div>
                    {params.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={p.enabled}
                          onChange={(e) => {
                            const n = [...params]
                            n[idx].enabled = e.target.checked
                            setParams(n)
                          }}
                          className="rounded"
                        />
                        <input
                          value={p.key}
                          onChange={(e) => {
                            const n = [...params]
                            n[idx].key = e.target.value
                            setParams(n)
                          }}
                          placeholder="Key"
                          className="flex-1 rounded border border-stone-200 px-2 py-1 outline-none font-mono"
                        />
                        <input
                          value={p.value}
                          onChange={(e) => {
                            const n = [...params]
                            n[idx].value = e.target.value
                            setParams(n)
                          }}
                          placeholder="Value"
                          className="flex-1 rounded border border-stone-200 px-2 py-1 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setParams(params.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-amber-600 font-semibold text-[11px] mt-1 hover:underline"
                      onClick={() => setParams([...params, { key: "", value: "", enabled: true }])}
                    >
                      + 添加参数
                    </button>
                  </div>
                )}

                {activeReqTab === "headers" && (
                  <div className="space-y-1">
                    <div className="flex items-center text-[11px] font-semibold text-stone-400 mb-1">
                      <span className="w-8">启用</span>
                      <span className="flex-1">请求头 (Key)</span>
                      <span className="flex-1">值 (Value)</span>
                    </div>
                    {headers.map((h, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={h.enabled}
                          onChange={(e) => {
                            const n = [...headers]
                            n[idx].enabled = e.target.checked
                            setHeaders(n)
                          }}
                          className="rounded"
                        />
                        <input
                          value={h.key}
                          onChange={(e) => {
                            const n = [...headers]
                            n[idx].key = e.target.value
                            setHeaders(n)
                          }}
                          placeholder="Key (例如: Content-Type)"
                          className="flex-1 rounded border border-stone-200 px-2 py-1 outline-none font-mono"
                        />
                        <input
                          value={h.value}
                          onChange={(e) => {
                            const n = [...headers]
                            n[idx].value = e.target.value
                            setHeaders(n)
                          }}
                          placeholder="Value"
                          className="flex-1 rounded border border-stone-200 px-2 py-1 outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setHeaders(headers.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="text-amber-600 font-semibold text-[11px] mt-1 hover:underline"
                      onClick={() => setHeaders([...headers, { key: "", value: "", enabled: true }])}
                    >
                      + 添加请求头
                    </button>
                  </div>
                )}

                {activeReqTab === "auth" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="font-semibold text-stone-600">认证类型:</label>
                      <select
                        value={authType}
                        onChange={(e) => setAuthType(e.target.value as any)}
                        className="rounded border border-stone-200 px-2 py-1"
                      >
                        <option value="none">No Auth</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="apiKey">API Key</option>
                      </select>
                    </div>

                    {authType === "bearer" && (
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-1">Token</label>
                        <input
                          value={authToken}
                          onChange={(e) => setAuthToken(e.target.value)}
                          placeholder="Bearer token 字符串…"
                          className="w-full rounded border border-stone-200 px-2.5 py-1.5 font-mono"
                        />
                      </div>
                    )}

                    {authType === "basic" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-500 mb-1">Username</label>
                          <input
                            value={authUsername}
                            onChange={(e) => setAuthUsername(e.target.value)}
                            className="w-full rounded border border-stone-200 px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-500 mb-1">Password</label>
                          <input
                            type="password"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            className="w-full rounded border border-stone-200 px-2 py-1 font-mono"
                          />
                        </div>
                      </div>
                    )}

                    {authType === "apiKey" && (
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-500 mb-1">Key 名称</label>
                          <input
                            value={apiKeyName}
                            onChange={(e) => setApiKeyName(e.target.value)}
                            placeholder="例如: X-API-Key"
                            className="w-full rounded border border-stone-200 px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-500 mb-1">Key 密钥值</label>
                          <input
                            value={apiKeyValue}
                            onChange={(e) => setApiKeyValue(e.target.value)}
                            className="w-full rounded border border-stone-200 px-2 py-1 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-500 mb-1">添加到</label>
                          <select
                            value={apiKeyLocation}
                            onChange={(e) => setApiKeyLocation(e.target.value as any)}
                            className="w-full rounded border border-stone-200 px-2 py-1"
                          >
                            <option value="header">Header</option>
                            <option value="query">Query Params</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeReqTab === "body" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      {["none", "raw", "x-www-form-urlencoded", "form-data"].map((t) => (
                        <label
                          key={t}
                          className="flex items-center gap-1.5 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="bodyType"
                            checked={bodyType === t}
                            onChange={() => setBodyType(t as any)}
                          />
                          <span>{t}</span>
                        </label>
                      ))}

                      {bodyType === "raw" && (
                        <select
                          value={rawType}
                          onChange={(e) => setRawType(e.target.value as any)}
                          className="rounded border border-stone-200 px-2 py-0.5 text-xs ml-auto"
                        >
                          <option value="json">JSON</option>
                          <option value="text">Text</option>
                          <option value="html">HTML</option>
                          <option value="xml">XML</option>
                        </select>
                      )}
                    </div>

                    {bodyType === "raw" && (
                      <textarea
                        rows={5}
                        value={bodyContent}
                        onChange={(e) => setBodyContent(e.target.value)}
                        placeholder='{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1\n}'
                        className="w-full rounded border border-stone-200 p-2 font-mono text-xs outline-none focus:border-amber-500"
                      />
                    )}
                  </div>
                )}

                {activeReqTab === "tests" && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-stone-600">断言测试脚本 (Postman 语法)</span>
                      <button
                        type="button"
                        className="text-amber-600 font-medium hover:underline text-[11px]"
                        onClick={() => setTestsScript(testsScript + `\npm.test("Response body check", function () {\n    pm.expect(pm.response.text()).to.include("ok");\n});`)}
                      >
                        + 插入代码片段
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={testsScript}
                      onChange={(e) => setTestsScript(e.target.value)}
                      className="w-full rounded border border-stone-200 p-2 font-mono text-xs outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>

              {/* 响应结果展示区 (Response Viewer) */}
              <div className="flex-1 min-h-0 flex flex-col bg-stone-50/30">
                {/* 响应状态指示栏 */}
                <div className="flex h-9 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-stone-500">响应 Response</span>
                    {response && (
                      <>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${response.status >= 200 && response.status < 300 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {response.status} {response.statusText}
                        </span>
                        <span className="text-stone-500">{response.durationMs} ms</span>
                        <span className="text-stone-500">{(response.sizeBytes / 1024).toFixed(2)} KB</span>
                      </>
                    )}
                  </div>

                  {response && (
                    <div className="flex items-center gap-1">
                      {/* Response Tabs */}
                      {["body", "headers", "tests"].map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveResTab(tab as any)}
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${activeResTab === tab ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
                        >
                          {tab === "body" ? "Body" : tab === "headers" ? "Headers" : `Tests (${response.testResults.length})`}
                        </button>
                      ))}

                      <button
                        type="button"
                        title="复制响应"
                        onClick={handleCopyResponse}
                        className="ml-2 flex size-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                      >
                        {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 响应内容 */}
                <div className="flex-1 overflow-auto p-3 text-xs bg-white font-mono">
                  {!response ? (
                    <div className="flex h-full items-center justify-center text-stone-400 font-sans">点击右上角“发送”按钮以发起请求</div>
                  ) : activeResTab === "body" ? (
                    <pre className="whitespace-pre-wrap break-all leading-relaxed text-stone-800">{formattedJson}</pre>
                  ) : activeResTab === "headers" ? (
                    <div className="space-y-1 font-sans">
                      {Object.entries(response.headers).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex gap-2 border-b border-stone-100 py-1"
                        >
                          <span className="w-48 font-semibold text-stone-600 truncate">{k}:</span>
                          <span className="flex-1 font-mono text-stone-800 break-all">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Tests 断言结果 */
                    <div className="space-y-2 font-sans">
                      <div className="font-semibold text-stone-700">
                        测试结果: 通过 {response.testResults.filter((t) => t.passed).length} / 总计 {response.testResults.length}
                      </div>
                      {response.testResults.map((t, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 rounded p-2 ${t.passed ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                        >
                          <span className="font-bold">{t.passed ? "PASS" : "FAIL"}</span>
                          <div>
                            <div>{t.name}</div>
                            {t.error && <div className="text-[11px] text-red-600 mt-0.5">{t.error}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  )
}
