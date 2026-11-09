import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import "@/components/ui/resize-handle.css"
import "@/components/core/canvas/variants/code/monaco"
import Editor from "@monaco-editor/react"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import "@/pages/postman/dark.css"
import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import type { ApiCollectionRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord, ApiResponseData } from "@vessel/type"
import { Activity, Check, Copy, FlaskConical, FolderPlus, Globe, HardDrive, Loader2, Play, Plus, Save, Send, Timer, Trash2 } from "lucide-react"
import { StatusBar } from "@/components/ui/status-bar"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

/** Renders the postman page component. */
export default function PostmanPage() {
  const navigate = useNavigate()
  const dark = useDarkAppearance()

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
  const uniqueHistory = useMemo(() => {
    const latest = new Map<string, ApiHistoryRecord>()
    for (const item of [...history].sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)) {
      const key = JSON.stringify([item.method.toUpperCase(), item.url])
      if (!latest.has(key)) latest.set(key, item)
    }
    return [...latest.values()]
  }, [history])
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
      <div id="vessel-api-client" className="vessel-api-page flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-800">
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
            <Select value={activeEnvId ?? "__none__"} onValueChange={(value) => {
              const id = value === "__none__" ? null : value
              void window.electronAPI.apiClient.setActiveEnvironment(id).then((updated) => {
                setActiveEnvId(id)
                setEnvironments(updated)
              }).catch((error) => toast.error(String(error)))
            }}>
              <SelectTrigger className="api-select-trigger h-8 w-48 text-xs" aria-label="请求环境"><SelectValue /></SelectTrigger>
              <SelectContent className="api-select-content">
                <SelectItem value="__none__">No Environment (无环境)</SelectItem>
                {environments.map((env) => <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>)}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              variant="outline"
              className="api-save-button h-8 gap-1.5 text-xs border-stone-200"
              onClick={handleSaveRequest}
            >
              <Save className="size-3.5" />
              <span>保存</span>
            </Button>
          </div>
        </header>

        {/* 主体分栏 */}
        <ResizablePanelGroup orientation="horizontal" className="overflow-hidden">
          {/* 左侧边栏 (Collections / History / Environments) */}
          <ResizablePanel id="api-sidebar" defaultSize="20%" minSize="160px" maxSize="40%">
          <aside className="h-full bg-stone-50/50 flex flex-col overflow-hidden">
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
                      data-title="新建集合"
                      className="rounded p-1 hover:bg-stone-200"
                      onClick={async () => {
                        const name = prompt("请输入集合名称:")
                        if (!name) return
                        const updated = await window.electronAPI.apiClient.saveCollection({
                          id: `col-${Date.now()}`,
                          name
                        })
                        setCollections(updated)
                      }} aria-label="新建集合"
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
                              data-title="批量运行 (Run)"
                              className="p-1 hover:text-green-700"
                              onClick={() => handleRunCollection(col.id)} aria-label="批量运行 (Run)"
                            >
                              <Play className="size-3 text-green-600" />
                            </button>
                            <button
                              type="button"
                              data-title="删除集合"
                              className="p-1 hover:text-red-700"
                              onClick={async () => {
                                if (!confirm(`确定删除集合 ${col.name} 吗？`)) return
                                const updated = await window.electronAPI.apiClient.deleteCollection(col.id)
                                setCollections(updated)
                              }} aria-label="删除集合"
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
                  {uniqueHistory.map((h) => (
                    <ContextMenu key={h.id}>
                    <ContextMenuTrigger asChild>
                    <div
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
                        data-title={h.url}
                      >
                        {h.url}
                      </div>
                    </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="api-history-menu w-32">
                      <ContextMenuItem className="text-red-600 focus:!bg-red-50 focus:!text-red-600" onSelect={() => {
                        void window.electronAPI.apiClient.deleteHistoryRequest(h.method, h.url).then(() => {
                          setHistory((current) => current.filter((item) => item.method.toUpperCase() !== h.method.toUpperCase() || item.url !== h.url))
                        }).catch((error) => toast.error(String(error)))
                      }}>
                        <Trash2 className="size-3.5" />
                        删除
                      </ContextMenuItem>
                    </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}

              {sidebarTab === "environments" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between font-semibold text-stone-500">
                    <span>环境变量</span>
                    <button
                      type="button"
                      data-title="添加环境"
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
                      }} aria-label="添加环境"
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
          </ResizablePanel>
          <ResizableHandle aria-label="调整 API 侧栏宽度" />
          <ResizablePanel id="api-main" minSize="360px">

          {/* 右侧主请求与响应区 */}
          <main className="h-full min-w-0 flex flex-col overflow-hidden">
            {/* URL 输入栏 */}
            <div className="p-3 border-b border-stone-200 bg-white flex items-center gap-2">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="api-select-trigger h-9 w-28 bg-stone-50 text-xs font-bold" aria-label="请求方法"><SelectValue /></SelectTrigger>
                <SelectContent className="api-select-content">
                  {["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}
                </SelectContent>
              </Select>

              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="输入 URL 或使用 {{baseUrl}}/api/v1/users…"
                className="api-url-input h-9 flex-1 rounded-md border border-stone-200 px-3 font-mono text-xs outline-none"
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
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel id="api-request" defaultSize="45%" minSize="140px" className="flex min-h-0 flex-col overflow-hidden">
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
              <div className={`min-h-0 flex-1 bg-white p-3 text-xs ${(activeReqTab === "body" || activeReqTab === "tests") ? "flex flex-col overflow-hidden" : "overflow-y-auto"}`}>
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
                      <Select value={authType} onValueChange={(value) => setAuthType(value as typeof authType)}>
                        <SelectTrigger className="api-select-trigger h-8 w-40 text-xs" aria-label="认证类型"><SelectValue /></SelectTrigger>
                        <SelectContent className="api-select-content">
                          <SelectItem value="none">No Auth</SelectItem>
                          <SelectItem value="bearer">Bearer Token</SelectItem>
                          <SelectItem value="basic">Basic Auth</SelectItem>
                          <SelectItem value="apiKey">API Key</SelectItem>
                        </SelectContent>
                      </Select>
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
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex shrink-0 items-center gap-4">
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
                      <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-amber-500">
                        <Editor
                          height="100%"
                          theme={dark ? "vessel-dark" : "light"}
                          beforeMount={registerMonacoTheme}
                          language={rawType === "text" ? "plaintext" : rawType}
                          value={bodyContent}
                          onChange={(value) => setBodyContent(value ?? "")}
                          options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 12, tabSize: 2, wordWrap: "on", scrollBeyondLastLine: false, ariaLabel: "请求 Body", padding: { top: 8 } }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {activeReqTab === "tests" && (
                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div className="flex shrink-0 items-center justify-between">
                      <span className="font-semibold text-stone-600">断言测试脚本 (Postman 语法)</span>
                      <button
                        type="button"
                        className="text-amber-600 font-medium hover:underline text-[11px]"
                        onClick={() => setTestsScript(testsScript + `\npm.test("Response body check", function () {\n    pm.expect(pm.response.text()).to.include("ok");\n});`)}
                      >
                        + 插入代码片段
                      </button>
                    </div>
                    <div className="min-h-0 min-w-0 flex-1 overflow-hidden rounded border border-amber-500">
                      <Editor
                        height="100%"
                        theme={dark ? "vessel-dark" : "light"}
                        beforeMount={registerMonacoTheme}
                        language="javascript"
                        value={testsScript}
                        onChange={(value) => setTestsScript(value ?? "")}
                        options={{ automaticLayout: true, minimap: { enabled: false }, fontSize: 12, tabSize: 2, wordWrap: "on", scrollBeyondLastLine: false, ariaLabel: "断言测试脚本", padding: { top: 8 } }}
                      />
                    </div>
                  </div>
                )}
              </div>

              </ResizablePanel>
              <ResizableHandle aria-label="调整请求与响应区域高度" />
              <ResizablePanel id="api-response" minSize="100px" className="flex min-h-0 flex-col overflow-hidden">
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
                        data-title="复制响应"
                        onClick={handleCopyResponse}
                        className="ml-2 flex size-6 items-center justify-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                      >
                        {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
                      </button>
                    </div>
                  )}
                </div>

                {/* 响应内容 */}
                <div className={`min-h-0 flex-1 bg-white text-xs font-mono ${response && activeResTab === "body" ? "overflow-hidden" : "overflow-auto p-3"}`}>
                  {!response ? (
                    <div className="flex h-full items-center justify-center text-stone-400 font-sans">点击右上角“发送”按钮以发起请求</div>
                  ) : activeResTab === "body" ? (
                    <Editor
                      height="100%"
                      theme={dark ? "vessel-dark" : "light"}
                      beforeMount={registerMonacoTheme}
                      language={(() => {
                        try { JSON.parse(response.body); return "json" } catch {}
                        const type = Object.entries(response.headers).find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? ""
                        if (type.includes("html")) return "html"
                        if (type.includes("xml")) return "xml"
                        if (type.includes("javascript")) return "javascript"
                        return "plaintext"
                      })()}
                      value={formattedJson}
                      options={{ readOnly: true, domReadOnly: true, automaticLayout: true, minimap: { enabled: false }, fontSize: 12, tabSize: 2, wordWrap: "on", scrollBeyondLastLine: false, ariaLabel: "响应内容", padding: { top: 12 } }}
                    />
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
              </ResizablePanel>
            </ResizablePanelGroup>
          </main>
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar
          left={<>
            <button type="button" data-title={`${method} ${url}`} onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("已复制请求地址"))}>
              <Send />
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{method}</span>
              <span className="max-w-64 truncate">{requestName}</span>
            </button>
            <button type="button" className="vessel-status-separated" data-title="切换环境请使用顶部环境选择器" onClick={() => setSidebarTab("environments")}>
              <Globe />
              {environments.find((env) => env.id === activeEnvId)?.name ?? "无环境"}
            </button>
          </>}
        >
          <footer aria-label="响应信息" className="vessel-document-stats">
            {loading ? <span><Loader2 className="animate-spin" />请求中…</span> : response ? <>
              <span className={response.status >= 200 && response.status < 300 ? "text-green-700 dark:text-green-400" : response.status >= 400 || response.status === 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}><Activity />{response.status} {response.statusText}</span>
              <span className="vessel-status-separated"><Timer />{response.durationMs} ms</span>
              <span><HardDrive />{(response.sizeBytes / 1024).toFixed(2)} KB</span>
              {response.testResults.length > 0 && <span><FlaskConical />测试 {response.testResults.filter((t) => t.passed).length}/{response.testResults.length}</span>}
            </> : <span className="text-stone-400">尚未发送请求</span>}
          </footer>
        </StatusBar>
      </div>
    </Layout>
  )
}
