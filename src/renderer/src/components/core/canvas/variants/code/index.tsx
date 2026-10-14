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
import { matchesShortcut } from "../../../../../../../shared/shortcuts"
import { Hash } from "lucide-react"
import { parseLinePosition } from "./go-to-line"

export default function CodeCanvas({ activeFilePath, revealPosition, highlightKeyword }: { activeFilePath: string; revealPosition?: { lineNumber: number; column: number }; highlightKeyword?: string }) {
  const [content, setContent] = useState<string>()
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [saveError, setSaveError] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [goto, setGoto] = useState(false)
  const decorationsRef = useRef<string[]>([])
  const reveal = () => {
    const editor = editorRef.current, model = editor?.getModel()
    if (!editor || !model || !revealPosition) return
    const lineNumber = Math.max(1, Math.min(model.getLineCount(), revealPosition.lineNumber))
    editor.setPosition({ lineNumber, column: Math.max(1, Math.min(model.getLineMaxColumn(lineNumber), revealPosition.column)) })
    editor.revealLineInCenter(lineNumber)
    if (highlightKeyword && highlightKeyword.trim()) {
      const lineText = model.getLineContent(lineNumber)
      const idx = lineText.toLowerCase().indexOf(highlightKeyword.trim().toLowerCase())
      if (idx >= 0) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
          {
            range: new monaco.Range(lineNumber, idx + 1, lineNumber, idx + 1 + highlightKeyword.trim().length),
            options: {
              inlineClassName: "vessel-monaco-highlight",
              isWholeLine: false
            }
          }
        ])
      }
    }
  }
  useEffect(reveal, [revealPosition?.lineNumber, revealPosition?.column, highlightKeyword, content])
  const [lineInput, setLineInput] = useState('1')
  const totalLines = content?.split('\n').length ?? 1
  const position = parseLinePosition(lineInput, totalLines, line => editorRef.current?.getModel()?.getLineMaxColumn(line) ?? 1)
  const line = position?.lineNumber ?? 0, column = position?.column ?? 1
  const valid = position !== null
  const closeGoto = () => { setGoto(false); editorRef.current?.focus() }
  const openGoto = () => { setLineInput(String(editorRef.current?.getPosition()?.lineNumber ?? 1)); setGoto(true) }
  useEffect(() => {
    if (goto) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [goto])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const container = containerRef.current
      if (!container || !container.contains(document.activeElement) || !matchesShortcut(event, 'goToLine')) return
      event.preventDefault(); event.stopImmediatePropagation(); openGoto()
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const scroll = (event: Event) => {
      const editor = editorRef.current
      if (editor) editor.setScrollTop((event as CustomEvent<boolean>).detail ? 0 : editor.getScrollHeight(), monaco.editor.ScrollType.Smooth)
    }
    container.addEventListener('vessel:scroll-boundary', scroll)
    return () => container.removeEventListener('vessel:scroll-boundary', scroll)
  }, [content === undefined])
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
    return () => { cancelled = true; mounted.current = false; if (codeEditors.get(activeFilePath) === editorRef.current) codeEditors.delete(activeFilePath) }
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
    <div ref={containerRef} data-vessel-scroll="code" className="vessel-code-editor relative min-h-0 flex-1">
      <Editor height="100%" path={monaco.Uri.file(activeFilePath).toString()} language={codeLanguage(activeFilePath) || "plaintext"} value={content}
        loading={<EditorLoading label="正在加载代码编辑器…" />}
        onChange={value => { if (value !== undefined && value !== content) { setContent(value); save(value) } }}
        onMount={editor => { editorRef.current = editor; codeEditors.set(activeFilePath, editor); reveal(); editor.onDidFocusEditorText(() => codeEditors.set(activeFilePath, editor)); editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(editor.getValue())) }}
        options={{ automaticLayout: true, scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false }, overviewRulerLanes: 0, hideCursorInOverviewRuler: true, minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false, tabSize: 2, renderWhitespace: "selection" }} />
      {goto && <div role="dialog" aria-label="跳转到行" className={`code-goto ${valid ? '' : 'code-goto-error'}`}>
        <div className="code-goto-row"><Hash size={20} className="shrink-0 text-stone-400" /><input ref={inputRef} aria-label="行号或行号:列号" value={lineInput} onChange={event => setLineInput(event.target.value)} placeholder="行:列，例如 12:20" autoComplete="off" spellCheck={false} onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGoto() }
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault(); event.stopPropagation()
            if (!valid) return
            editorRef.current?.setPosition({ lineNumber: line, column })
            editorRef.current?.revealLineInCenter(line, monaco.editor.ScrollType.Smooth)
            closeGoto()
          }
        }} /><span>共 {totalLines} 行</span></div>
        <div className="code-goto-hint"><kbd>Enter</kbd> 跳转 <kbd>Esc</kbd> 关闭 <span role="status" className={valid ? 'text-green-700' : 'text-red-600'}>{valid ? `→ 跳转至 第 ${line} 行${column > 1 ? `，第 ${column} 列` : ''}` : `请输入有效行列（1–${totalLines} 行）`}</span></div>
      </div>}
    </div>
    <StatusSlot><footer className="flex shrink-0 flex-wrap items-center gap-5 bg-transparent px-2 py-1 text-xs text-stone-500">
      <span role={saveError ? "alert" : "status"} className={`mr-auto ${saveError ? "text-red-500" : ""}`}>{status}</span>
      {diagnosticError && <span role="alert" className="text-amber-600">{diagnosticError}</span>}
      <span>{stats.words.toLocaleString()} 词</span>
      <span>{stats.characters.toLocaleString()} 字符</span>
      <span>{stats.lines.toLocaleString()} 行</span>
      <span>{codeLanguage(activeFilePath) || "plaintext"} · UTF-8</span>
    </footer></StatusSlot>
  </div>
}
