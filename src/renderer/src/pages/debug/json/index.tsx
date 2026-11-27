import "@/pages/debug/workbench.css"
import { jsonDocuments, addJsonDocument, activateJsonDocument, removeJsonDocument, updateJsonDocument, jsonDocumentUri, type JsonDocument } from "./documents"
import { jsonizeJsonInput, parseJsonInput } from "./parse-json-input"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { useMonacoTheme } from "@/features/editor-appearance/use-monaco-theme"
import { monaco } from "@/components/core/canvas/variants/code/monaco"
import "@/components/styles/tool-page-header.css"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import Editor from "@monaco-editor/react"
import type { JsonShareInfo } from "@vessel/type"
import { Archive, Share2, Plus, X, Braces, Code, Copy, Download, RotateCw, Trash2 } from "lucide-react"
import type { editor as MonacoEditor } from "monaco-editor"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"

/** Multiple independent JSON drafts, with only the active Monaco editor mounted. */
export function JsonTool() {
  const [documents, setDocuments] = useState(() => [...jsonDocuments.items])
  const [activeId, setActiveId] = useState(jsonDocuments.activeId)
  const [focusEditor, setFocusEditor] = useState(true)
  const [closing, setClosing] = useState<JsonDocument | null>(null)
  const [closeBusy, setCloseBusy] = useState(false)
  const tabs = useRef<HTMLDivElement>(null)
  const active = documents.find(document => document.id === activeId) || documents[0]
  const refresh = () => setDocuments([...jsonDocuments.items])
  const select = (id: string, keyboard = false) => { activateJsonDocument(id); setActiveId(id); setFocusEditor(!keyboard) }
  const add = () => {
    const document = addJsonDocument()
    refresh()
    select(document.id)
  }
  useEffect(() => {
    const tab = tabs.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    if (!focusEditor) tab?.focus()
  }, [activeId, focusEditor])

  const close = async (document: JsonDocument) => {
    setCloseBusy(true)
    try {
      await window.electronAPI.stopJsonShare(document.id)
      removeJsonDocument(document.id)
      setActiveId(jsonDocuments.activeId)
      refresh()
      setClosing(null)
      // Let the departing editor detach before removing its retained model and undo history.
      setTimeout(() => { if (monaco.Uri) monaco.editor?.getModel(monaco.Uri.parse(jsonDocumentUri(document.id)))?.dispose() }, 0)
    } catch (error) { toast.error("关闭 JSON 失败", { description: String(error) }) }
    finally { setCloseBusy(false) }
  }
  const tabBar = <div className="dev-json-tabs-bar">
    <ScrollArea horizontal type="hover" className="min-w-0 flex-1 [&_[data-orientation=vertical]]:hidden">
      <div ref={tabs} role="tablist" aria-label="JSON 文档" className="dev-json-tabs">
        {documents.map(document => <div key={document.id} className="dev-json-tab" data-active={document.id === active.id}>
          <button type="button" role="tab" id={`json-tab-${document.id}`} aria-selected={document.id === active.id} aria-controls={`json-panel-${document.id}`} tabIndex={document.id === active.id ? 0 : -1}
            onClick={() => select(document.id)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
              event.preventDefault()
              const index = documents.findIndex(item => item.id === document.id)
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? documents.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + documents.length) % documents.length
              select(documents[next].id, true)
              tabs.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
            }}>
            <Braces size={14} /><span>{document.name}</span>{document.share && <Share2 size={12} aria-label="分享中" />}
          </button>
          <button type="button" aria-label={`关闭 ${document.name}`} className="dev-json-tab-close" disabled={closeBusy} onClick={() => document.value.trim() || document.share ? setClosing(document) : void close(document)}><X size={12} /></button>
        </div>)}
      </div>
    </ScrollArea>
    <span className="dev-json-tab-count">{documents.length} 份 JSON</span>
  </div>
  return <>
    <JsonDocumentEditor key={active.id} draft={active} focusEditor={focusEditor} onUpdate={refresh} onAdd={add} tabBar={tabBar} />
    <Dialog open={!!closing} onOpenChange={open => { if (!open && !closeBusy) setClosing(null) }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>关闭 {closing?.name}？</DialogTitle><DialogDescription>关闭后会移除此文档的内容，并停止它的局域网分享。</DialogDescription></DialogHeader>
        <DialogFooter><Button variant="outline" disabled={closeBusy} onClick={() => setClosing(null)}>保留文档</Button><Button disabled={closeBusy} onClick={() => closing && void close(closing)}>关闭文档</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}

function JsonDocumentName({ draft, onUpdate }: { draft: JsonDocument; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(draft.name)
  const cancelled = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])
  const save = () => {
    const next = name.trim()
    if (!cancelled.current && next) {
      updateJsonDocument(draft.id, { name: next })
      onUpdate()
    }
    setEditing(false)
  }
  return editing ? <input
    ref={inputRef}
    aria-label="JSON 文档名称"
    className="vessel-field h-7 w-48 min-w-0 px-2 text-sm"
    maxLength={100}
    value={name}
    onChange={event => setName(event.target.value)}
    onBlur={save}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelled.current = true; setEditing(false) }
    }}
  /> : <button type="button" className="dev-json-document-name max-w-64 truncate text-left" data-title="双击重命名" onDoubleClick={() => { cancelled.current = false; setName(draft.name); setEditing(true) }}>{draft.name}</button>
}

function JsonDocumentEditor({ draft, focusEditor, onUpdate, onAdd, tabBar }: { draft: JsonDocument; focusEditor: boolean; onUpdate: () => void; onAdd: () => void; tabBar: ReactNode }) {
  const editorTheme = useMonacoTheme()
  const [value, setValueState] = useState(() => draft.value)
  const [error, setErrorState] = useState(() => draft.error)
  const setValue = (value: string) => { updateJsonDocument(draft.id, { value }); setValueState(value); onUpdate() }
  const setError = (error: string) => { updateJsonDocument(draft.id, { error }); setErrorState(error) }
  const [share, setShareState] = useState<JsonShareInfo | null>(draft.share)
  const setShare = (info: JsonShareInfo | null) => { updateJsonDocument(draft.id, { share: info }); setShareState(info); onUpdate() }
  const [shareBusy, setShareBusy] = useState(true)
  const [saveBusy, setSaveBusy] = useState(false)
  const editor = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    let active = true
    void window.electronAPI.getJsonShare(draft.id)
      .then(info => { if (active) setShare(info) })
      .catch(error => { if (active) toast.error("读取分享状态失败", { description: String(error) }) })
      .finally(() => { if (active) setShareBusy(false) })
    return () => { active = false }
  }, [])

  const toggleShare = async () => {
    setShareBusy(true)
    try {
      if (share) {
        await window.electronAPI.stopJsonShare(draft.id)
        setShare(null)
      } else {
        const snapshot = JSON.stringify(parseJsonInput(editor.current?.getValue() ?? value), null, 2)
        setShare(await window.electronAPI.startJsonShare(snapshot, draft.id))
      }
    } catch (error) {
      toast.error(share ? "取消分享失败" : "开启分享失败", { description: error instanceof Error ? error.message : String(error) })
    } finally { setShareBusy(false) }
  }

  useEffect(() => () => {
    const instance = editor.current
    if (instance?.getModel()) updateJsonDocument(draft.id, { view: instance.saveViewState() })
    editor.current = null
  }, [])

  /** Replaces replace. */
  const replace = (text: string) => {
    const instance = editor.current
    const model = instance?.getModel()
    if (instance && model) {
      instance.pushUndoStop()
      instance.executeEdits("json-tool", [{ range: model.getFullModelRange(), text }])
      instance.pushUndoStop()
    }
    setValue(text)
    setError("")
  }

  /** Transforms transform. */
  const transform = (compact: boolean, jsonize = false) => {
    try {
      replace(JSON.stringify(jsonize ? jsonizeJsonInput(value) : parseJsonInput(value), null, compact ? undefined : 2))
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    }
  }

  const saveToLocal = async () => {
    if (saveBusy) return
    setSaveBusy(true)
    const name = Array.from(draft.name, character => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? "_" : character).join("").replace(/[. ]+$/, "") || "JSON"
    try {
      const saved = await window.apiClient.saveFile(/\.json$/i.test(name) ? name : `${name}.json`, value)
      if (saved) toast.success("JSON 已保存到本地")
    } catch (error) {
      toast.error("保存 JSON 失败", { description: error instanceof Error ? error.message : String(error) })
    } finally { setSaveBusy(false) }
  }
  return (
    <div className="dev-tool-page dev-json-page flex h-full min-h-0 min-w-0 flex-col">
      <header className="tool-page-header">
        <span className="tool-page-brand">
          <Code size={16} />
        </span>
        <div className="tool-page-heading">
          <h2>JSON 格式化</h2>
          <p>多文档独立编辑 · 本地处理 · 支持转义 JSON</p>
        </div>
        <div className="tool-page-actions">
          <Button size="sm" variant="outline" onClick={onAdd}><Plus size={14} />新增 JSON</Button>
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={() => transform(false)}
          >
            <RotateCw size={13} />
            格式化
          </Button>
          <Button
            size="sm"
            variant="outline"
            title="将所有层级中可解析的 JSON 对象和数组字符串展开为结构"
            onClick={() => transform(false, true)}
          >
            <Braces size={13} />
            JSON 化
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => transform(true)}
          >
            <Archive size={13} />
            压缩
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={shareBusy || (!share && !value.trim())}
            onClick={() => void toggleShare()}
          >
            {share ? <X size={13} /> : <Share2 size={13} />}
            {share ? "取消分享" : "分享"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="复制内容"
            data-title="复制内容"
            disabled={!value}
            onClick={() =>
              void navigator.clipboard
                .writeText(value)
                .then(() => toast.success("已复制"))
                .catch((error) => toast.error(String(error)))
            }
          >
            <Copy size={14} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!value || saveBusy}
            onClick={() => void saveToLocal()}
          >
            <Download size={14} />{saveBusy ? "保存中…" : "保存到本地"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="清空内容"
            data-title="清空内容"
            disabled={!value}
            onClick={() => replace("")}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </header>
      {tabBar}
      {share && (
        <div role="region" aria-label="局域网分享" className="shrink-0 border-b bg-green-50/60 px-4 py-3 text-sm dark:bg-green-950/20">
          <p className="font-medium">局域网分享中</p>
          <p className="mt-1 text-xs text-muted-foreground">同一局域网内可访问以下链接。分享开启时的内容，取消分享或关闭软件后失效。</p>
          <div className="mt-2 flex flex-col gap-2">
            {share.urls.map(url => (
              <div key={url} className="flex min-w-0 items-center gap-2">
                <input aria-label="局域网分享链接" className="vessel-field min-w-0 flex-1 font-mono text-xs" readOnly value={url} onFocus={event => event.target.select()} />
                <Button size="sm" variant="outline" onClick={() => void navigator.clipboard.writeText(url).then(() => toast.success("分享链接已复制")).catch(error => toast.error("复制链接失败", { description: String(error) }))}>
                  <Copy size={13} />复制链接
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="shrink-0 bg-red-50 px-4 py-2 text-xs text-red-600"
        >
          {error}
        </p>
      )}
      <div role="tabpanel" id={`json-panel-${draft.id}`} aria-labelledby={`json-tab-${draft.id}`} className="dev-json-workspace min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="dev-field-header"><JsonDocumentName draft={draft} onUpdate={onUpdate} /><span className="dev-field-meta">{value.length.toLocaleString()} 字符</span><span className="ml-auto text-muted-foreground">UTF-8 · 2 空格</span></div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
        {!value && <div aria-hidden="true" className="dev-json-empty"><span><Braces size={26} /></span><p>粘贴 JSON，开始编辑</p><small>每份文档独立保留内容，可随时切换</small></div>}
        <Editor
          loading={<PageSkeleton editorOnly />}
          theme={editorTheme}
          height="100%"
          language="json"
          path={jsonDocumentUri(draft.id)}
          keepCurrentModel
          saveViewState={false}
          value={value}
          beforeMount={registerMonacoTheme}
          onMount={(instance) => {
            editor.current = instance
            if (draft.view) instance.restoreViewState(draft.view)
            if (focusEditor) instance.focus()
          }}
          onChange={(text) => {
            setValue(text ?? "")
            setError("")
          }}
          options={{
            ariaLabel: "JSON 编辑器",
            automaticLayout: true,
            fontSize: 13,
            tabSize: 2,
            lineNumbers: "on",
            folding: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 14, bottom: 14 },
            bracketPairColorization: { enabled: true },
            formatOnPaste: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            overviewRulerLanes: 0
          }}
        />
        </div>
      </div>
    </div>
  )
}
