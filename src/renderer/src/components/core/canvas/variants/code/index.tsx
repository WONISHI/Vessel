import { useExternalContent } from "@/pages/workspace/hooks/file-changes"
import { StatusSlot } from "@/pages/workspace/components/layout-main/status-slot"
import { countDocument } from "../markdown/count-document"
import "./index.css"
import { codeEditors } from "./search-bridge"
import Editor from "@monaco-editor/react"
import { useEffect, useRef, useState, useMemo, useDeferredValue } from "react"
import { monaco } from "./monaco"
import { codeLanguage } from "./language"
import { EditorLoading } from "@/components/ui/editor-loading"

export default function CodeCanvas({ activeFilePath }: { activeFilePath: string }) {
  const [content, setContent] = useState<string>()
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [saveError, setSaveError] = useState(false)
  useExternalContent(activeFilePath, content, value => { setContent(value); setStatus("已从磁盘更新") })
  const deferredContent = useDeferredValue(content ?? "")
  const stats = useMemo(() => countDocument(deferredContent), [deferredContent])
  const revision = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void window.electronAPI.readContent(activeFilePath).then(value => {
      if (!cancelled) {
        if (value.includes("\0")) setError("该文件包含二进制内容，无法作为代码编辑。")
        else setContent(value)
      }
    }).catch(error => { if (!cancelled) setError(String(error)) })
    return () => { cancelled = true; mounted.current = false; codeEditors.delete(activeFilePath) }
  }, [activeFilePath])
  const [diagnosticError, setDiagnosticError] = useState("")
  useEffect(() => {
    if (content === undefined || !/\.[cm]?[jt]sx?$/i.test(activeFilePath)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.electronAPI.getCodeDiagnostics(activeFilePath, content).then(diagnostics => {
        if (cancelled) return
        setDiagnosticError("")
        const model = monaco.editor.getModel(monaco.Uri.file(activeFilePath))
        if (model) monaco.editor.setModelMarkers(model, "vessel-project", diagnostics.map(diagnostic => ({
          ...diagnostic, code: String(diagnostic.code), source: "TypeScript",
          severity: diagnostic.severity === "error" ? monaco.MarkerSeverity.Error : diagnostic.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info
        })))
      }).catch(error => { if (!cancelled) setDiagnosticError(`代码检查失败：${String(error)}`) })
    }, 600)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [activeFilePath, content])
  const save = (value: string) => {
    const request = ++revision.current
    setStatus("正在保存…")
    setSaveError(false)
    void window.electronAPI.saveContent(activeFilePath, value).then(() => {
      if (mounted.current && revision.current === request) setStatus("已保存")
    }).catch(error => {
      if (mounted.current && revision.current === request) { setStatus(`保存失败：${String(error)}`); setSaveError(true) }
    })
  }
  if (error) return <p role="alert" className="p-4 text-red-500">读取失败：{error}</p>
  if (content === undefined) return <EditorLoading label="正在读取代码…" />
  return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
    <div className="vessel-code-editor min-h-0 flex-1">
      <Editor height="100%" path={monaco.Uri.file(activeFilePath).toString()} language={codeLanguage(activeFilePath)} value={content}
        loading={<EditorLoading label="正在加载代码编辑器…" />}
        onChange={value => { if (value !== undefined && value !== content) { setContent(value); save(value) } }}
        onMount={editor => { codeEditors.set(activeFilePath, editor); editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(editor.getValue())) }}
        options={{ automaticLayout: true, scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false }, overviewRulerLanes: 0, hideCursorInOverviewRuler: true, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, tabSize: 2, renderWhitespace: "selection" }} />
    </div>
    <StatusSlot><footer className="flex shrink-0 flex-wrap items-center gap-5 bg-transparent px-2 py-1 text-xs text-stone-500">
      <span role={saveError ? "alert" : "status"} className={`mr-auto ${saveError ? "text-red-500" : ""}`}>{status}</span>
      {diagnosticError && <span role="alert" className="text-amber-600">{diagnosticError}</span>}
      <span>{stats.words.toLocaleString()} 词</span>
      <span>{stats.characters.toLocaleString()} 字符</span>
      <span>{stats.lines.toLocaleString()} 行</span>
      <span>{codeLanguage(activeFilePath)} · UTF-8</span>
    </footer></StatusSlot>
  </div>
}
