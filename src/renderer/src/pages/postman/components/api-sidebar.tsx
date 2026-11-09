import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { toast } from "@/components/ui/sonner"
import { RadioGroup } from "@/components/ui/radio-group"
import { NameDialog } from "@/pages/postman/components/api-dialog"
import { ApiRadio } from "@/pages/postman/components/api-controls"
import { METHOD_COLOR } from "@/pages/postman/lib/model"
import type { ApiCollectionRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord } from "@vessel/type"
import { ChevronRight, Copy, Download, Folder, FolderOpen, FolderPlus, Pencil, Play, Plus, Search, Trash2, Upload, X } from "lucide-react"
import { useState, type DragEvent, type ReactNode } from "react"

type SidebarTab = "collections" | "history" | "environments"
type DragItem = { kind: "collection" | "request"; id: string }
type DropHint = { id: string; position: "before" | "after" | "inside" }
type NameRequest = { title: string; label: string; initial?: string; icon: typeof Folder; confirmText?: string; submit: (value: string) => Promise<void> }
type DeleteRequest = { title: string; description: string; run: () => Promise<void> }

const COLLAPSED_KEY = "vessel-api-collapsed"
const byOrder = <T extends { sortOrder?: number }>(list: T[]) => [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
const short = (method: string) => (method === "DELETE" ? "DEL" : method === "OPTIONS" ? "OPT" : method)

/** Groups history entries by day label (今天 / 昨天 / date). */
function dayLabel(time: number) {
  const date = new Date(time)
  const today = new Date()
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / 86400000)
  return diff === 0 ? "今天" : diff === 1 ? "昨天" : `${date.getMonth() + 1}月${date.getDate()}日`
}

export interface ApiSidebarProps {
  tab: SidebarTab
  onTabChange: (tab: SidebarTab) => void
  collections: ApiCollectionRecord[]
  requests: ApiRequestRecord[]
  history: ApiHistoryRecord[]
  environments: ApiEnvironmentRecord[]
  activeEnvId: string | null
  activeRequestId: string | null
  dirtyRequestIds: Set<string>
  onReload: () => Promise<void>
  onOpenRequest: (record: ApiRequestRecord) => void
  onNewRequest: (collectionId: string) => void
  onOpenHistory: (entry: ApiHistoryRecord) => void
  onHistoryChange: (history: ApiHistoryRecord[]) => void
  onRunCollection: (collection: ApiCollectionRecord) => void
  onExportCollection: (collection: ApiCollectionRecord) => void
  onImport: () => void
  onRequestRenamed: (id: string, name: string) => void
  onRequestsDeleted: (ids: string[]) => void
  onEditEnvironment: (environment: ApiEnvironmentRecord | null) => void
  onActivateEnvironment: (id: string | null) => void
}

/** API sidebar: collection tree (folders, drag sorting, context actions), grouped history and environments. */
export function ApiSidebar(props: ApiSidebarProps) {
  const { tab, onTabChange, collections, requests, history, environments, activeEnvId, activeRequestId, dirtyRequestIds, onReload } = props
  const [filter, setFilter] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]") as string[]) } catch { return new Set() }
  })
  const [drag, setDrag] = useState<DragItem | null>(null)
  const [hint, setHint] = useState<DropHint | null>(null)
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null)
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const api = window.electronAPI.apiClient

  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]))
    return next
  })

  const query = filter.trim().toLowerCase()
  const matches = (request: ApiRequestRecord) => !query || request.name.toLowerCase().includes(query) || request.url.toLowerCase().includes(query)
  let visibleFolders: Set<string> | null = null
  if (query) {
    visibleFolders = new Set<string>()
    for (const request of requests.filter(matches)) {
      let id = request.collectionId
      while (id) {
        visibleFolders.add(id)
        id = collections.find((item) => item.id === id)?.parentId ?? null
      }
    }
  }

  /** Moves an item before a sibling (or to the end) under `parentId`, renumbering that sibling list. */
  const move = async (item: DragItem, parentId: string | null, beforeId: string | null) => {
    if (item.kind === "request" && !parentId) return
    const siblings = item.kind === "collection" ? byOrder(collections.filter((entry) => entry.parentId === parentId && entry.id !== item.id)) : byOrder(requests.filter((entry) => entry.collectionId === parentId && entry.id !== item.id))
    const ids = siblings.map((entry) => entry.id)
    const index = beforeId ? ids.indexOf(beforeId) : -1
    ids.splice(index === -1 ? ids.length : index, 0, item.id)
    try {
      await api.reorder(ids.map((id, sortOrder) => ({ kind: item.kind, id, parentId, sortOrder })))
      await onReload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "") : String(error))
    }
  }

  const dropPosition = (event: DragEvent, kind: DragItem["kind"]): DropHint["position"] => {
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientY - rect.top) / rect.height
    if (kind === "request") return ratio < 0.5 ? "before" : "after"
    return ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside"
  }

  const dropOn = (event: DragEvent, target: DragItem) => {
    event.preventDefault()
    const position = hint?.position
    setHint(null)
    if (!drag || drag.id === target.id || !position) return
    if (target.kind === "request") {
      const record = requests.find((item) => item.id === target.id)!
      if (drag.kind === "request") {
        const siblings = byOrder(requests.filter((item) => item.collectionId === record.collectionId && item.id !== drag.id))
        const index = siblings.findIndex((item) => item.id === record.id)
        void move(drag, record.collectionId, position === "before" ? record.id : (siblings[index + 1]?.id ?? null))
      } else void move(drag, record.collectionId, null)
      return
    }
    const folder = collections.find((item) => item.id === target.id)!
    if (position === "inside") {
      void move(drag, folder.id, null)
      if (collapsed.has(folder.id)) toggle(folder.id)
      return
    }
    if (drag.kind === "request") {
      void move(drag, folder.id, null)
      return
    }
    const siblings = byOrder(collections.filter((item) => item.parentId === folder.parentId && item.id !== drag.id))
    const index = siblings.findIndex((item) => item.id === folder.id)
    void move(drag, folder.parentId, position === "before" ? folder.id : (siblings[index + 1]?.id ?? null))
  }

  const dragProps = (item: DragItem) => ({
    draggable: !query,
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move"
      event.dataTransfer.setData("text/plain", item.id)
      setDrag(item)
    },
    onDragEnd: () => { setDrag(null); setHint(null) },
    onDragOver: (event: DragEvent) => {
      if (!drag || drag.id === item.id) return
      event.preventDefault()
      const position = dropPosition(event, item.kind)
      if (hint?.id !== item.id || hint.position !== position) setHint({ id: item.id, position })
    },
    onDragLeave: () => setHint((current) => (current?.id === item.id ? null : current)),
    onDrop: (event: DragEvent) => dropOn(event, item)
  })

  const hintClass = (id: string) => (hint?.id !== id ? "" : hint.position === "before" ? "shadow-[inset_0_2px_0_#f59e0b]" : hint.position === "after" ? "shadow-[inset_0_-2px_0_#f59e0b]" : "bg-amber-100/70 ring-1 ring-amber-400")

  const newFolder = (parentId: string | null) => setNameRequest({
    title: parentId ? "新建文件夹" : "新建集合",
    label: "名称",
    icon: parentId ? FolderPlus : Folder,
    confirmText: "创建",
    submit: async (name) => {
      await api.saveCollection({ id: `col-${crypto.randomUUID()}`, name, parentId })
      if (parentId && collapsed.has(parentId)) toggle(parentId)
      await onReload()
    }
  })

  const descendants = (id: string): string[] => [id, ...collections.filter((item) => item.parentId === id).flatMap((item) => descendants(item.id))]

  const renderFolder = (folder: ApiCollectionRecord, depth: number): ReactNode => {
    if (visibleFolders && !visibleFolders.has(folder.id)) return null
    const open = !collapsed.has(folder.id) || !!query
    const childFolders = byOrder(collections.filter((item) => item.parentId === folder.id))
    const childRequests = byOrder(requests.filter((item) => item.collectionId === folder.id && matches(item)))
    const root = folder.parentId === null
    return (
      <div key={folder.id}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              {...dragProps({ kind: "collection", id: folder.id })}
              role="treeitem"
              aria-expanded={open}
              tabIndex={0}
              onClick={() => toggle(folder.id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(folder.id) } }}
              style={{ paddingLeft: 6 + depth * 14 }}
              className={`group flex h-7 cursor-pointer items-center gap-1 rounded pr-1 text-stone-700 hover:bg-stone-200/60 ${root ? "font-semibold" : ""} ${drag?.id === folder.id ? "opacity-40" : ""} ${hintClass(folder.id)}`}
            >
              <ChevronRight className={`size-3 shrink-0 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`} />
              {open ? <FolderOpen className="size-3.5 shrink-0 text-amber-500" /> : <Folder className="size-3.5 shrink-0 text-amber-500" />}
              <span className="min-w-0 flex-1 truncate">{folder.name}</span>
              <span className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                <button type="button" aria-label="新建请求" data-title="新建请求" className="rounded p-1 text-stone-400 hover:text-amber-600" onClick={(event) => { event.stopPropagation(); props.onNewRequest(folder.id) }}><Plus className="size-3" /></button>
                <button type="button" aria-label="运行" data-title="运行集合 (Runner)" className="rounded p-1 text-green-600 hover:text-green-700" onClick={(event) => { event.stopPropagation(); props.onRunCollection(folder) }}><Play className="size-3" /></button>
              </span>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="api-history-menu w-40">
            <ContextMenuItem onSelect={() => props.onNewRequest(folder.id)}><Plus className="size-3.5" />新建请求</ContextMenuItem>
            <ContextMenuItem onSelect={() => newFolder(folder.id)}><FolderPlus className="size-3.5" />新建文件夹</ContextMenuItem>
            <ContextMenuItem onSelect={() => setNameRequest({ title: "重命名", label: "名称", initial: folder.name, icon: Pencil, submit: async (name) => { await api.saveCollection({ id: folder.id, name, parentId: folder.parentId }); await onReload() } })}><Pencil className="size-3.5" />重命名</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => props.onRunCollection(folder)}><Play className="size-3.5" />运行</ContextMenuItem>
            <ContextMenuItem onSelect={() => props.onExportCollection(folder)}><Download className="size-3.5" />导出 (Postman v2.1)</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem className="api-menu-danger" onSelect={() => {
              const ids = descendants(folder.id)
              const count = requests.filter((item) => item.collectionId && ids.includes(item.collectionId)).length
              setDeleteRequest({
                title: root ? "删除集合" : "删除文件夹",
                description: `确定删除「${folder.name}」吗？其中的 ${ids.length - 1} 个子文件夹和 ${count} 个请求会一并删除，此操作无法撤销。`,
                run: async () => {
                  const removed = requests.filter((item) => item.collectionId && ids.includes(item.collectionId)).map((item) => item.id)
                  await api.deleteCollection(folder.id)
                  props.onRequestsDeleted(removed)
                  await onReload()
                }
              })
            }}><Trash2 className="size-3.5" />删除</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {open && (
          <div role="group">
            {childFolders.map((child) => renderFolder(child, depth + 1))}
            {childRequests.map((request) => renderRequest(request, depth + 1))}
            {!childFolders.length && !childRequests.length && !query && <div style={{ paddingLeft: 26 + depth * 14 }} className="py-1 text-[11px] italic text-stone-400">空文件夹，<button type="button" className="text-amber-600 not-italic hover:underline" onClick={() => props.onNewRequest(folder.id)}>添加请求</button></div>}
          </div>
        )}
      </div>
    )
  }

  const renderRequest = (request: ApiRequestRecord, depth: number) => (
    <ContextMenu key={request.id}>
      <ContextMenuTrigger asChild>
        <div
          {...dragProps({ kind: "request", id: request.id })}
          role="treeitem"
          tabIndex={0}
          aria-selected={activeRequestId === request.id}
          onClick={() => props.onOpenRequest(request)}
          onKeyDown={(event) => { if (event.key === "Enter") props.onOpenRequest(request) }}
          style={{ paddingLeft: 22 + depth * 14 }}
          className={`flex h-7 cursor-pointer items-center gap-2 rounded pr-2 ${activeRequestId === request.id ? "bg-amber-100/70 font-medium" : "hover:bg-stone-100"} ${drag?.id === request.id ? "opacity-40" : ""} ${hintClass(request.id)}`}
        >
          <span className={`w-8 shrink-0 text-[10px] font-bold ${METHOD_COLOR[request.method] ?? "text-blue-600"}`}>{short(request.method)}</span>
          <span className="min-w-0 flex-1 truncate text-stone-700">{request.name}</span>
          {dirtyRequestIds.has(request.id) && <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-label="未保存" />}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="api-history-menu w-36">
        <ContextMenuItem onSelect={() => props.onOpenRequest(request)}><FolderOpen className="size-3.5" />打开</ContextMenuItem>
        <ContextMenuItem onSelect={() => setNameRequest({ title: "重命名请求", label: "名称", initial: request.name, icon: Pencil, submit: async (name) => { await api.saveRequest({ ...request, name }); props.onRequestRenamed(request.id, name); await onReload() } })}><Pencil className="size-3.5" />重命名</ContextMenuItem>
        <ContextMenuItem onSelect={() => void api.duplicateRequest(request.id).then(onReload).catch((error) => toast.error(String(error)))}><Copy className="size-3.5" />复制</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="api-menu-danger" onSelect={() => setDeleteRequest({ title: "删除请求", description: `确定删除请求「${request.name}」吗？此操作无法撤销。`, run: async () => { await api.deleteRequest(request.id); props.onRequestsDeleted([request.id]); await onReload() } })}><Trash2 className="size-3.5" />删除</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )

  const historyGroups: { label: string; items: ApiHistoryRecord[] }[] = []
  const seenHistory = new Set<string>()
  for (const entry of history) {
    const key = `${entry.method.toUpperCase()} ${entry.url}`
    if (seenHistory.has(key) || (query && !entry.url.toLowerCase().includes(query))) continue
    seenHistory.add(key)
    const label = dayLabel(entry.createdAt)
    const group = historyGroups.at(-1)
    if (group?.label === label) group.items.push(entry)
    else historyGroups.push({ label, items: [entry] })
  }

  const orphanRequests = byOrder(requests.filter((item) => !item.collectionId && matches(item)))
  const tabButton = (id: SidebarTab, label: string) => (
    <button type="button" role="tab" aria-selected={tab === id} className={`flex-1 py-2 text-center transition-colors ${tab === id ? "border-b-2 border-amber-600 bg-white font-semibold text-amber-700" : "text-stone-500 hover:text-stone-800"}`} onClick={() => onTabChange(id)}>{label}</button>
  )
  const smallButton = "rounded p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-800"

  return (
    <aside className="flex h-full flex-col overflow-hidden bg-stone-50/50">
      <div className="flex border-b border-stone-200 text-xs font-medium" role="tablist">
        {tabButton("collections", "集合")}
        {tabButton("history", "历史")}
        {tabButton("environments", "环境")}
      </div>
      {tab !== "environments" && (
        <div className="flex items-center gap-1 border-b border-stone-200 px-2 py-1.5">
          <div className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border border-stone-200 bg-white px-2 focus-within:border-amber-500">
            <Search className="size-3 shrink-0 text-stone-400" />
            <input aria-label="搜索" value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={tab === "collections" ? "搜索请求名称或 URL" : "搜索历史 URL"} className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" />
            {filter && <button type="button" aria-label="清除搜索" className="text-stone-400 hover:text-stone-700" onClick={() => setFilter("")}><X className="size-3" /></button>}
          </div>
          {tab === "collections" && <>
            <button type="button" aria-label="新建集合" data-title="新建集合" className={smallButton} onClick={() => newFolder(null)}><FolderPlus className="size-3.5" /></button>
            <button type="button" aria-label="导入" data-title="导入 cURL / Postman" className={smallButton} onClick={props.onImport}><Upload className="size-3.5" /></button>
          </>}
          {tab === "history" && history.length > 0 && <button type="button" aria-label="清空历史" data-title="清空历史" className={smallButton} onClick={() => setDeleteRequest({ title: "清空历史", description: "确定清空全部请求历史吗？", run: async () => { await api.clearHistory(); props.onHistoryChange([]) } })}><Trash2 className="size-3.5" /></button>}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5 text-xs" role={tab === "collections" ? "tree" : undefined} aria-label={tab === "collections" ? "集合" : undefined}>
        {tab === "collections" && <>
          {collections.length === 0 && orphanRequests.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-stone-400">
              <Folder className="size-8 text-stone-300" />
              <p>还没有集合</p>
              <div className="flex gap-2">
                <button type="button" className="rounded border border-stone-200 bg-white px-2 py-1 text-stone-600 hover:border-amber-400" onClick={() => newFolder(null)}>新建集合</button>
                <button type="button" className="rounded border border-stone-200 bg-white px-2 py-1 text-stone-600 hover:border-amber-400" onClick={props.onImport}>导入</button>
              </div>
            </div>
          )}
          {byOrder(collections.filter((item) => item.parentId === null)).map((collection) => renderFolder(collection, 0))}
          {orphanRequests.length > 0 && <>
            <div className="mt-2 px-2 py-1 text-[11px] font-semibold text-stone-400">未分组</div>
            {orphanRequests.map((request) => renderRequest(request, -1))}
          </>}
          {query && visibleFolders?.size === 0 && orphanRequests.length === 0 && collections.length > 0 && <p className="px-2 py-6 text-center text-stone-400">没有匹配的请求</p>}
        </>}

        {tab === "history" && (historyGroups.length === 0 ? <p className="px-2 py-6 text-center text-stone-400">{query ? "没有匹配的历史" : "暂无请求历史"}</p> : historyGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">{group.label}</div>
            {group.items.map((entry) => (
              <ContextMenu key={entry.id}>
                <ContextMenuTrigger asChild>
                  <div role="button" tabIndex={0} onClick={() => props.onOpenHistory(entry)} onKeyDown={(event) => { if (event.key === "Enter") props.onOpenHistory(entry) }} className="flex h-7 cursor-pointer items-center gap-2 rounded px-2 hover:bg-stone-100">
                    <span className={`w-8 shrink-0 text-[10px] font-bold ${METHOD_COLOR[entry.method.toUpperCase()] ?? "text-blue-600"}`}>{short(entry.method.toUpperCase())}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-stone-600">{entry.url.replace(/^https?:\/\//, "")}</span>
                    <span className={`shrink-0 text-[10px] font-semibold ${entry.status >= 200 && entry.status < 300 ? "text-green-600" : entry.status === 0 ? "text-red-500" : "text-amber-600"}`}>{entry.status || "ERR"}</span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="api-history-menu w-32">
                  <ContextMenuItem onSelect={() => props.onOpenHistory(entry)}><FolderOpen className="size-3.5" />打开</ContextMenuItem>
                  <ContextMenuItem className="api-menu-danger" onSelect={() => {
                    void api.deleteHistoryRequest(entry.method, entry.url).then(() => props.onHistoryChange(history.filter((item) => item.method.toUpperCase() !== entry.method.toUpperCase() || item.url !== entry.url))).catch((error) => toast.error(String(error)))
                  }}><Trash2 className="size-3.5" />删除</ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            ))}
          </div>
        )))}

        {tab === "environments" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-1 pb-1 font-semibold text-stone-500">
              <span>环境</span>
              <button type="button" aria-label="新建环境" data-title="新建环境" className={smallButton} onClick={() => props.onEditEnvironment(null)}><Plus className="size-3.5" /></button>
            </div>
            <RadioGroup value={activeEnvId ?? "__none__"} onValueChange={(value) => { if (value) props.onActivateEnvironment(value === "__none__" ? null : value) }} aria-label="当前环境" className="gap-1">
            <label className={`flex h-8 cursor-pointer items-center gap-2 rounded px-2 ${activeEnvId === null ? "bg-amber-100/70" : "hover:bg-stone-100"}`}>
              <ApiRadio value="__none__" aria-label="无环境" />
              <span className="text-stone-500">无环境</span>
            </label>
            {environments.map((environment) => {
              let count = 0
              try { count = (JSON.parse(environment.variables) as unknown[]).length } catch { /* malformed variables */ }
              return (
                <div key={environment.id} className={`group flex h-8 items-center gap-2 rounded px-2 ${activeEnvId === environment.id ? "bg-amber-100/70" : "hover:bg-stone-100"}`}>
                  <ApiRadio value={environment.id} aria-label={`使用 ${environment.name}`} />
                  <button type="button" className="min-w-0 flex-1 truncate text-left text-stone-700" onClick={() => props.onEditEnvironment(environment)}>{environment.name}</button>
                  <span className="text-[10px] text-stone-400">{count} 个变量</span>
                  <button type="button" aria-label="编辑环境" className="rounded p-1 text-stone-400 opacity-0 hover:text-amber-600 group-hover:opacity-100" onClick={() => props.onEditEnvironment(environment)}><Pencil className="size-3" /></button>
                </div>
              )
            })}
            </RadioGroup>
            <p className="px-2 pt-2 text-[11px] leading-relaxed text-stone-400">在 URL、参数、请求头和 Body 中使用 {"{{变量名}}"} 引用当前环境的变量；脚本中可用 pm.environment.set 写入。</p>
          </div>
        )}
      </div>

      {nameRequest && <NameDialog title={nameRequest.title} label={nameRequest.label} initial={nameRequest.initial} icon={nameRequest.icon} confirmText={nameRequest.confirmText} onClose={() => setNameRequest(null)} onSubmit={nameRequest.submit} />}
      <ConfirmDialog
        open={!!deleteRequest}
        onOpenChange={(open) => { if (!open) setDeleteRequest(null) }}
        title={deleteRequest?.title ?? ""}
        description={deleteRequest?.description ?? ""}
        confirmText="删除"
        busy={deleting}
        onConfirm={() => {
          if (!deleteRequest) return
          setDeleting(true)
          void deleteRequest.run().then(() => setDeleteRequest(null)).catch((error) => toast.error(String(error))).finally(() => setDeleting(false))
        }}
      />
    </aside>
  )
}
