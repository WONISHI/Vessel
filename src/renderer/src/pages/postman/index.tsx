import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import "@/components/ui/resize-handle.css"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import "@/pages/postman/dark.css"
import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "@/components/ui/sonner"
import { StatusBar } from "@/components/ui/status-bar"
import { ApiSidebar } from "@/pages/postman/components/api-sidebar"
import { ApiHelpDialog } from "@/pages/postman/components/api-help-dialog"
import { CodeDialog, CookiesDialog, EnvironmentDialog, ImportDialog, RunnerDialog, SaveRequestDialog } from "@/pages/postman/components/api-dialogs"
import { RequestEditor } from "@/pages/postman/components/request-editor"
import { RequestTabs } from "@/pages/postman/components/request-tabs"
import { ResponsePanel } from "@/pages/postman/components/response-panel"
import { applyEnvUpdates, createTab, draftFromRecord, draftToRecord, draftToSendOptions, envRows, envVarMap, isDirty, newDraft, snapshotOf, type RequestDraft, type RequestTab } from "@/pages/postman/lib/model"
import { exportPostman } from "@/pages/postman/lib/postman-collection"
import { paramsFromUrl, splitUrl, urlWithParams } from "@/pages/postman/lib/url-params"
import type { ApiCollectionRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord, ApiRunResult, ApiSendOptions } from "@vessel/type"
import { Activity, ChevronRight, CircleQuestionMark, Cookie, Eye, FlaskConical, Globe, HardDrive, Loader2, Send, Timer, Upload } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"

const TABS_KEY = "vessel-api-tabs-v1"

let memoryTabs: { tabs: RequestTab[]; activeId: string } | undefined

/** Restores open request tabs; responses survive page switches via the in-memory cache but not app restarts. */
function loadTabs(): { tabs: RequestTab[]; activeId: string } {
  if (memoryTabs) return { activeId: memoryTabs.activeId, tabs: memoryTabs.tabs.map((tab) => ({ ...tab, loading: false })) }
  try {
    const stored = JSON.parse(localStorage.getItem(TABS_KEY) || "null") as { tabs: { id: string; draft: RequestDraft; saved: string }[]; activeId: string } | null
    if (stored?.tabs?.length) {
      const tabs = stored.tabs.map((tab) => ({ ...tab, draft: newDraft(tab.draft), response: null, loading: false }))
      return { tabs, activeId: tabs.some((tab) => tab.id === stored.activeId) ? stored.activeId : tabs[0].id }
    }
  } catch {
    /* fall through to a fresh tab */
  }
  const tab = createTab(newDraft({ url: "{{baseUrl}}/posts/1" }))
  return { tabs: [tab], activeId: tab.id }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "")

/** Rebuilds a draft from a history entry's stored send options. */
function draftFromHistory(entry: ApiHistoryRecord): RequestDraft {
  let options: Partial<ApiSendOptions> = {}
  try { options = JSON.parse(entry.requestData) } catch { /* old/malformed entry: fall back to method + url */ }
  const baseUrl = options.url || entry.url
  const url = options.params?.length && splitUrl(baseUrl).query === null ? urlWithParams(baseUrl, options.params) : baseUrl
  const isForm = options.bodyType === "form-data" || options.bodyType === "x-www-form-urlencoded"
  let form: RequestDraft["bodyForm"] = []
  if (isForm) try { form = JSON.parse(options.bodyContent || "[]") } catch { /* keep empty */ }
  let name = entry.url
  try { name = new URL(entry.url).pathname } catch { /* keep raw url */ }
  return newDraft({
    name,
    method: (options.method || entry.method).toUpperCase(),
    url,
    params: paramsFromUrl(url, []),
    headers: options.headers ?? [],
    bodyType: options.bodyType === "binary" || !options.bodyType ? "none" : options.bodyType,
    rawType: options.rawType ?? "json",
    bodyRaw: isForm ? "" : (options.bodyContent ?? ""),
    bodyForm: form,
    authType: options.authType ?? "none",
    auth: { ...newDraft().auth, ...options.authConfig },
    preRequest: options.preRequestScript ?? "",
    tests: options.tests ?? ""
  })
}

/** API client page: Postman-like multi-tab requests, collections, environments, scripts and import/export. */
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

  const api = window.electronAPI.apiClient
  const [sidebarTab, setSidebarTab] = useState<"collections" | "history" | "environments">("collections")
  const [collections, setCollections] = useState<ApiCollectionRecord[]>([])
  const [requests, setRequests] = useState<ApiRequestRecord[]>([])
  const [history, setHistory] = useState<ApiHistoryRecord[]>([])
  const [environments, setEnvironments] = useState<ApiEnvironmentRecord[]>([])
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null)
  const [initial] = useState(loadTabs)
  const [tabs, setTabs] = useState<RequestTab[]>(initial.tabs)
  const [activeId, setActiveId] = useState(initial.activeId)
  const [envDialog, setEnvDialog] = useState<ApiEnvironmentRecord | null | undefined>(undefined)
  const [saveTabId, setSaveTabId] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [codeOpen, setCodeOpen] = useState(false)
  const [cookiesOpen, setCookiesOpen] = useState(false)
  const [runner, setRunner] = useState<{ name: string; result: ApiRunResult | null } | null>(null)
  const [closing, setClosing] = useState<string[] | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const tabsRef = useRef(tabs)
  useEffect(() => {
    tabsRef.current = tabs
  }, [tabs])

  /** Loads data. */
  const loadData = useCallback(async () => {
    try {
      const [colls, reqs, hist, envs] = await Promise.all([api.listCollections(), api.listRequests(), api.listHistory(200), api.listEnvironments()])
      setCollections(colls)
      setRequests(reqs)
      setHistory(hist)
      setEnvironments(envs)
      setActiveEnvId(envs.find((e) => e.isActive)?.id ?? null)
    } catch (e) {
      toast.error(`加载数据失败: ${errorText(e)}`)
    }
  }, [api])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    memoryTabs = { tabs, activeId }
    const timer = setTimeout(() => localStorage.setItem(TABS_KEY, JSON.stringify({ tabs: tabs.map(({ id, draft, saved }) => ({ id, draft, saved })), activeId })), 300)
    return () => clearTimeout(timer)
  }, [tabs, activeId])

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  const activeEnv = environments.find((env) => env.id === activeEnvId)
  const vars = useMemo(() => envVarMap(activeEnv), [activeEnv])
  const dirtyRequestIds = useMemo(() => new Set(tabs.filter((tab) => tab.draft.savedId && isDirty(tab)).map((tab) => tab.draft.savedId!)), [tabs])
  const breadcrumb = useMemo(() => {
    const names: string[] = []
    let id = activeTab.draft.collectionId
    while (id) {
      const folder = collections.find((item) => item.id === id)
      if (!folder) break
      names.unshift(folder.name)
      id = folder.parentId
    }
    return names
  }, [activeTab.draft.collectionId, collections])

  const updateTab = (id: string, update: (tab: RequestTab) => RequestTab) => setTabs((current) => current.map((tab) => (tab.id === id ? update(tab) : tab)))
  const patchDraft = (patch: Partial<RequestDraft>) => updateTab(activeTab.id, (tab) => ({ ...tab, draft: { ...tab.draft, ...patch } }))

  const addTab = (tab: RequestTab) => {
    setTabs((current) => {
      const active = current.find((item) => item.id === activeId)
      const pristine = active && !active.draft.savedId && !isDirty(active) && !active.response && !active.loading
      return pristine ? current.map((item) => (item.id === active.id ? tab : item)) : [...current, tab]
    })
    setActiveId(tab.id)
  }

  const openRequest = (record: ApiRequestRecord) => {
    const existing = tabsRef.current.find((tab) => tab.draft.savedId === record.id)
    if (existing) setActiveId(existing.id)
    else addTab(createTab(draftFromRecord(record)))
  }

  const newTab = (collectionId: string | null = null) => {
    const tab = createTab(newDraft({ collectionId }))
    setTabs((current) => [...current, tab])
    setActiveId(tab.id)
  }

  const closeTabs = (ids: string[], force = false) => {
    if (!force && tabsRef.current.some((tab) => ids.includes(tab.id) && isDirty(tab))) {
      setClosing(ids)
      return
    }
    const remaining = tabsRef.current.filter((tab) => !ids.includes(tab.id))
    if (!remaining.length) {
      const tab = createTab()
      setTabs([tab])
      setActiveId(tab.id)
      return
    }
    if (ids.includes(activeId)) {
      const index = tabsRef.current.findIndex((tab) => tab.id === activeId)
      const next = tabsRef.current.slice(index + 1).find((tab) => !ids.includes(tab.id)) ?? [...tabsRef.current.slice(0, index)].reverse().find((tab) => !ids.includes(tab.id))
      setActiveId(next?.id ?? remaining[0].id)
    }
    setTabs(remaining)
  }

  /** Persists a tab's draft; unsaved drafts first ask where to save. */
  const saveTab = async (tabId: string, location?: { name: string; collectionId: string }) => {
    const tab = tabsRef.current.find((item) => item.id === tabId)
    if (!tab) return
    if (!tab.draft.savedId && !location) {
      setSaveTabId(tabId)
      return
    }
    const id = tab.draft.savedId ?? `req-${crypto.randomUUID()}`
    const draft: RequestDraft = { ...tab.draft, savedId: id, ...(location ?? {}) }
    try {
      await api.saveRequest(draftToRecord(draft, id))
      updateTab(tabId, (current) => ({ ...current, draft: { ...current.draft, savedId: id, ...(location ?? {}) }, saved: snapshotOf(draft) }))
      setRequests(await api.listRequests())
      toast.success("请求已保存")
    } catch (error) {
      toast.error(`保存失败: ${errorText(error)}`)
      throw error
    }
  }

  /** Writes script variable changes back into the active environment. */
  const persistEnvUpdates = async (updates: Record<string, string | null> | undefined) => {
    if (!updates || !Object.keys(updates).length) return
    if (!activeEnv) {
      toast.warning("脚本修改了环境变量，但当前未选择环境，修改未保存")
      return
    }
    try {
      setEnvironments(await api.saveEnvironment({ ...activeEnv, variables: JSON.stringify(applyEnvUpdates(envRows(activeEnv), updates)) }))
    } catch (error) {
      toast.error(`更新环境变量失败: ${errorText(error)}`)
    }
  }

  const send = async () => {
    const tab = activeTab
    if (tab.loading) return
    if (!tab.draft.url.trim()) {
      toast.error("请输入请求 URL")
      return
    }
    updateTab(tab.id, (current) => ({ ...current, loading: true }))
    try {
      const response = await api.send(draftToSendOptions(tab.draft, vars))
      updateTab(tab.id, (current) => ({ ...current, response, loading: false }))
      await persistEnvUpdates(response.envUpdates)
      setHistory(await api.listHistory(200))
    } catch (error) {
      updateTab(tab.id, (current) => ({ ...current, loading: false }))
      toast.error(`请求失败: ${errorText(error)}`)
    }
  }

  const runCollection = async (collection: ApiCollectionRecord) => {
    setRunner({ name: collection.name, result: null })
    try {
      const result = await api.runCollection(collection.id, vars)
      setRunner({ name: collection.name, result })
      await persistEnvUpdates(result.envUpdates)
      setHistory(await api.listHistory(200))
    } catch (error) {
      setRunner(null)
      toast.error(`批量运行失败: ${errorText(error)}`)
    }
  }

  const exportCollection = async (collection: ApiCollectionRecord) => {
    try {
      const data = exportPostman(collection.id, collections, requests)
      if (await api.saveFile(`${collection.name}.postman_collection.json`, JSON.stringify(data, null, 2))) toast.success("集合已导出")
    } catch (error) {
      toast.error(`导出失败: ${errorText(error)}`)
    }
  }

  const activateEnvironment = (id: string | null) => {
    void api.setActiveEnvironment(id).then((updated) => {
      setActiveEnvId(id)
      setEnvironments(updated)
    }).catch((error) => toast.error(errorText(error)))
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    if (event.key === "s") {
      event.preventDefault()
      void saveTab(activeTab.id).catch(() => undefined)
    } else if (event.key === "Enter") {
      event.preventDefault()
      void send()
    }
  }

  const response = activeTab.response
  const saveTarget = saveTabId ? tabs.find((tab) => tab.id === saveTabId) : null
  const headerButton = "flex h-8 items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-600 hover:border-amber-400 hover:text-stone-900"

  return (
    <Layout
      aside={
        <LayoutActivityBar
          activity="postman"
          onActivityChange={handleActivityChange}
        />
      }
    >
      <div id="vessel-api-client" onKeyDown={onKeyDown} className="vessel-api-page flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-800">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-stone-200 bg-stone-50/70 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-white">P</div>
            {breadcrumb.length > 0 && <span className="flex min-w-0 shrink items-center gap-1 truncate text-xs text-stone-400">{breadcrumb.join(" / ")}<ChevronRight className="size-3 shrink-0" /></span>}
            <input
              aria-label="请求名称"
              value={activeTab.draft.name}
              onChange={(event) => patchDraft({ name: event.target.value })}
              className="min-w-24 max-w-80 rounded px-2 py-1 text-sm font-semibold text-stone-800 outline-none hover:bg-stone-200/50 focus:bg-white focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <button type="button" className={headerButton} onClick={() => setImportOpen(true)} data-title="导入 cURL / Postman 集合"><Upload className="size-3.5" />导入</button>
            <button type="button" className={headerButton} onClick={() => setCookiesOpen(true)} data-title="管理 Cookies"><Cookie className="size-3.5" />Cookies</button>
            <Select value={activeEnvId ?? "__none__"} onValueChange={(value) => { if (value) activateEnvironment(value === "__none__" ? null : value) }}>
              <SelectTrigger className="api-select-trigger h-8 w-44 text-xs" aria-label="请求环境"><SelectValue /></SelectTrigger>
              <SelectContent className="api-select-content">
                <SelectItem value="__none__">No Environment (无环境)</SelectItem>
                {environments.map((env) => <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <button type="button" aria-label="查看当前环境变量" data-title={activeEnv ? `编辑「${activeEnv.name}」的变量` : "新建环境"} className={`${headerButton} px-2`} onClick={() => setEnvDialog(activeEnv ?? null)}><Eye className="size-3.5" /></button>
          </div>
        </header>

        <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 overflow-hidden">
          <ResizablePanel id="api-sidebar" defaultSize="22%" minSize="200px" maxSize="40%">
            <ApiSidebar
              tab={sidebarTab}
              onTabChange={setSidebarTab}
              collections={collections}
              requests={requests}
              history={history}
              environments={environments}
              activeEnvId={activeEnvId}
              activeRequestId={activeTab.draft.savedId}
              dirtyRequestIds={dirtyRequestIds}
              onReload={loadData}
              onOpenRequest={openRequest}
              onNewRequest={(collectionId) => newTab(collectionId)}
              onOpenHistory={(entry) => addTab(createTab(draftFromHistory(entry)))}
              onHistoryChange={setHistory}
              onRunCollection={(collection) => void runCollection(collection)}
              onExportCollection={(collection) => void exportCollection(collection)}
              onImport={() => setImportOpen(true)}
              onRequestRenamed={(id, name) => setTabs((current) => current.map((tab) => (tab.draft.savedId === id ? { ...tab, draft: { ...tab.draft, name }, saved: JSON.stringify({ ...JSON.parse(tab.saved), name }) } : tab)))}
              onRequestsDeleted={(ids) => setTabs((current) => current.map((tab) => (tab.draft.savedId && ids.includes(tab.draft.savedId) ? { ...tab, draft: { ...tab.draft, savedId: null, collectionId: null }, saved: snapshotOf(newDraft()) } : tab)))}
              onEditEnvironment={setEnvDialog}
              onActivateEnvironment={activateEnvironment}
            />
          </ResizablePanel>
          <ResizableHandle aria-label="调整 API 侧栏宽度" />
          <ResizablePanel id="api-main" minSize="420px">
            <main className="flex h-full min-w-0 flex-col overflow-hidden">
              <RequestTabs
                tabs={tabs}
                activeId={activeTab.id}
                onSelect={setActiveId}
                onClose={(id) => closeTabs([id])}
                onCloseOthers={(id) => closeTabs(tabs.filter((tab) => tab.id !== id).map((tab) => tab.id))}
                onDuplicate={(id) => {
                  const source = tabs.find((tab) => tab.id === id)
                  if (!source) return
                  const tab = createTab({ ...structuredClone(source.draft), savedId: null, name: `${source.draft.name} 副本` })
                  setTabs((current) => [...current, tab])
                  setActiveId(tab.id)
                }}
                onNew={() => newTab()}
              />
              <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
                <ResizablePanel id="api-request" defaultSize="50%" minSize="160px" className="flex min-h-0 flex-col overflow-hidden">
                  <RequestEditor
                    key={activeTab.id}
                    draft={activeTab.draft}
                    onChange={patchDraft}
                    vars={vars}
                    loading={activeTab.loading}
                    dirty={isDirty(activeTab)}
                    onSend={() => void send()}
                    onSave={() => void saveTab(activeTab.id).catch(() => undefined)}
                    onCode={() => setCodeOpen(true)}
                  />
                </ResizablePanel>
                <ResizableHandle aria-label="调整请求与响应区域高度" />
                <ResizablePanel id="api-response" minSize="100px" className="flex min-h-0 flex-col overflow-hidden">
                  <ResponsePanel key={activeTab.id} response={response} loading={activeTab.loading} onManageCookies={() => setCookiesOpen(true)} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>

        <StatusBar
          left={<>
            <button type="button" aria-label="使用说明" data-title="使用说明：脚本、环境变量与 pm 对象" onClick={() => setHelpOpen(true)}>
              <CircleQuestionMark />
            </button>
            <button type="button" className="vessel-status-separated" data-title={`${activeTab.draft.method} ${activeTab.draft.url}，点击复制 URL`} onClick={() => void navigator.clipboard.writeText(activeTab.draft.url).then(() => toast.success("已复制请求地址"))}>
              <Send />
              <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{activeTab.draft.method}</span>
              <span className="max-w-64 truncate">{activeTab.draft.name}</span>
              {isDirty(activeTab) && <span className="size-1.5 rounded-full bg-amber-500" aria-label="未保存" />}
            </button>
            <button type="button" className="vessel-status-separated" data-title="管理环境" onClick={() => setSidebarTab("environments")}>
              <Globe />
              {activeEnv?.name ?? "无环境"}
            </button>
          </>}
        >
          <footer aria-label="响应信息" className="vessel-document-stats">
            {activeTab.loading ? <span><Loader2 className="animate-spin" />请求中…</span> : response ? <>
              <span className={response.status >= 200 && response.status < 300 ? "text-green-700 dark:text-green-400" : response.status >= 400 || response.status === 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}><Activity />{response.status} {response.statusText}</span>
              <span className="vessel-status-separated"><Timer />{response.durationMs} ms</span>
              <span><HardDrive />{(response.sizeBytes / 1024).toFixed(2)} KB</span>
              {response.testResults.length > 0 && <span><FlaskConical />测试 {response.testResults.filter((t) => t.passed).length}/{response.testResults.length}</span>}
            </> : <span className="text-stone-400">尚未发送请求</span>}
          </footer>
        </StatusBar>

        {envDialog !== undefined && <EnvironmentDialog key={envDialog?.id ?? "new"} environment={envDialog} onClose={() => setEnvDialog(undefined)} onChanged={(list, nextActive) => { setEnvironments(list); if (nextActive !== undefined) setActiveEnvId(nextActive) }} />}
        {saveTarget && <SaveRequestDialog draft={saveTarget.draft} collections={collections} onClose={() => setSaveTabId(null)} onSave={(name, collectionId) => saveTab(saveTarget.id, { name, collectionId })} />}
        {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onCurl={(draft) => addTab(createTab(draft))} onImported={async (list) => { if (list) setEnvironments(list); await loadData(); setSidebarTab("collections") }} />}
        {codeOpen && <CodeDialog draft={activeTab.draft} vars={vars} onClose={() => setCodeOpen(false)} />}
        {cookiesOpen && <CookiesDialog onClose={() => setCookiesOpen(false)} />}
        {helpOpen && <ApiHelpDialog onClose={() => setHelpOpen(false)} />}
        {runner && <RunnerDialog name={runner.name} result={runner.result} onClose={() => setRunner(null)} />}
        <ConfirmDialog
          open={!!closing}
          onOpenChange={(open) => { if (!open) setClosing(null) }}
          title="关闭未保存的标签"
          description={`${closing?.length === 1 ? "该请求" : "部分请求"}有未保存的修改，关闭后修改将丢失。`}
          confirmText="不保存并关闭"
          onConfirm={() => {
            if (closing) closeTabs(closing, true)
            setClosing(null)
          }}
        />
      </div>
    </Layout>
  )
}
