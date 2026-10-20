import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { registerMonacoTheme } from "@/components/core/canvas/variants/code/theme"
import { parseLinePosition } from "@/components/core/canvas/variants/code/go-to-line"
import "@/components/core/canvas/variants/code/index.css"
import { codeLanguage } from "@/components/core/canvas/variants/code/language"
import { monaco } from "@/components/core/canvas/variants/code/monaco"
import { codeEditors } from "@/components/core/canvas/variants/code/search-bridge"
import { countDocument } from "@/components/core/canvas/variants/markdown/count-document"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { EditorLoading } from "@/components/ui/editor-loading"
import { Kbd } from "@/components/ui/kbd"
import { StatusSlot } from "@/components/workspace/components/layout-main/status-slot"
import { useExternalContent } from "@/components/workspace/hooks/file-changes"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import Editor from "@monaco-editor/react"
import { matchesShortcut } from "@vessel/utils"
import { Hash } from "lucide-react"
import { Fragment, useContext, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

interface BreadcrumbSegment {
  name: string
  path: string
}

/** Returns breadcrumb segments. */
function getBreadcrumbSegments(workspacePath: string, filePath: string, workspaceName?: string): BreadcrumbSegment[] {
  const normWorkspace = workspacePath.replace(/\\/g, "/")
  const normFile = filePath.replace(/\\/g, "/")
  const rootName = workspaceName || normWorkspace.split("/").filter(Boolean).pop() || "工作区"

  const segments: BreadcrumbSegment[] = [{ name: rootName, path: workspacePath }]

  if (!normWorkspace || !normFile.startsWith(normWorkspace)) {
    const parts = normFile.split("/").filter(Boolean)
    if (parts.length) {
      let current = ""
      return parts.map((part, i) => {
        current += (i === 0 && filePath.startsWith("/") ? "/" : i === 0 ? "" : "/") + part
        return { name: part, path: current }
      })
    }
    return segments
  }

  const rel = normFile.slice(normWorkspace.length).replace(/^\/+/, "")
  if (!rel) return segments

  const parts = rel.split("/").filter(Boolean)
  let accumulated = normWorkspace
  for (const part of parts) {
    accumulated += "/" + part
    segments.push({ name: part, path: accumulated })
  }
  return segments
}

/** Renders the code canvas component. */
export default function CodeCanvas({ activeFilePath, workspacePath, revealPosition, highlightKeyword }: { activeFilePath: string; workspacePath?: string; revealPosition?: { lineNumber: number; column: number }; highlightKeyword?: string }) {
  const dark = useDarkAppearance()
  const workspaceContext = useContext(WorkspaceContext)
  const effectiveWorkspacePath = workspacePath || workspaceContext?.workspace?.path || ""
  const workspaceName = workspaceContext?.workspace?.name

  const breadcrumbSegments = useMemo(() => {
    return getBreadcrumbSegments(effectiveWorkspacePath, activeFilePath, workspaceName)
  }, [effectiveWorkspacePath, activeFilePath, workspaceName])

  /** Handles locate events. */
  const handleLocate = (targetPath: string) => {
    window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: targetPath }))
  }

  const [content, setContent] = useState<string>()
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")
  const [saveError, setSaveError] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [goto, setGoto] = useState(false)
  const decorationsRef = useRef<string[]>([])

  /** Performs the reveal operation. */
  const reveal = () => {
    const editor = editorRef.current,
      model = editor?.getModel()
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
  const [lineInput, setLineInput] = useState("1")
  const totalLines = content?.split("\n").length ?? 1
  const position = parseLinePosition(lineInput, totalLines, (line) => editorRef.current?.getModel()?.getLineMaxColumn(line) ?? 1)
  const line = position?.lineNumber ?? 0,
    column = position?.column ?? 1
  const valid = position !== null

  /** Closes goto. */
  const closeGoto = () => {
    setGoto(false)
    editorRef.current?.focus()
  }

  /** Opens goto. */
  const openGoto = () => {
    setLineInput(String(editorRef.current?.getPosition()?.lineNumber ?? 1))
    setGoto(true)
  }
  useEffect(() => {
    if (goto) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [goto])
  useEffect(() => {
    /** Performs the key operation. */
    const key = (event: KeyboardEvent) => {
      const container = containerRef.current
      if (!container || !container.contains(document.activeElement) || !matchesShortcut(event, "goToLine")) return
      event.preventDefault()
      event.stopImmediatePropagation()
      openGoto()
    }
    window.addEventListener("keydown", key, true)
    return () => window.removeEventListener("keydown", key, true)
  }, [])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    /** Performs the scroll operation. */
    const scroll = (event: Event) => {
      const editor = editorRef.current
      if (editor) editor.setScrollTop((event as CustomEvent<boolean>).detail ? 0 : editor.getScrollHeight(), monaco.editor.ScrollType.Smooth)
    }
    container.addEventListener("vessel:scroll-boundary", scroll)
    return () => container.removeEventListener("vessel:scroll-boundary", scroll)
  }, [content === undefined])
  useExternalContent(activeFilePath, content, (value) => {
    setContent(value)
    setStatus("已从磁盘更新")
  })
  const deferredContent = useDeferredValue(content ?? "")
  const stats = useMemo(() => countDocument(deferredContent), [deferredContent])
  const revision = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    let cancelled = false
    void window.electronAPI
      .readContent(activeFilePath)
      .then((value) => {
        if (!cancelled) {
          if (value.includes("\0")) setError("该文件包含二进制内容，无法作为代码编辑。")
          else setContent(value)
        }
      })
      .catch((error) => {
        if (!cancelled) setError(String(error))
      })
    return () => {
      cancelled = true
      mounted.current = false
      if (codeEditors.get(activeFilePath) === editorRef.current) codeEditors.delete(activeFilePath)
    }
  }, [activeFilePath])
  const [diagnosticError, setDiagnosticError] = useState("")
  useEffect(() => {
    if (content === undefined || !/\.[cm]?[jt]sx?$/i.test(activeFilePath)) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void window.electronAPI
        .getCodeDiagnostics(activeFilePath, content)
        .then((diagnostics) => {
          if (cancelled) return
          setDiagnosticError("")
          const model = monaco.editor.getModel(monaco.Uri.file(activeFilePath))
          if (model)
            monaco.editor.setModelMarkers(
              model,
              "vessel-project",
              diagnostics.map((diagnostic) => ({
                ...diagnostic,
                code: String(diagnostic.code),
                source: "TypeScript",
                severity: diagnostic.severity === "error" ? monaco.MarkerSeverity.Error : diagnostic.severity === "warning" ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info
              }))
            )
        })
        .catch((error) => {
          if (!cancelled) setDiagnosticError(`代码检查失败：${String(error)}`)
        })
    }, 600)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activeFilePath, content])

  /** Saves save. */
  const save = (value: string) => {
    const request = ++revision.current
    setStatus("正在保存…")
    setSaveError(false)
    void window.electronAPI
      .saveContent(activeFilePath, value)
      .then(() => {
        if (mounted.current && revision.current === request) setStatus("已保存")
      })
      .catch((error) => {
        if (mounted.current && revision.current === request) {
          setStatus(`保存失败：${String(error)}`)
          setSaveError(true)
        }
      })
  }

  if (error) {
    const isNotFound = error.includes("ENOENT") || error.includes("no such file")
    return (
      <div
        role="alert"
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-sm"
      >
        <p className="font-medium text-red-500">{isNotFound ? "该文件不存在或已被删除" : `读取失败：${error}`}</p>
        <p className="max-w-md break-all text-xs text-stone-400">{activeFilePath}</p>
        {workspaceContext && (
          <button
            type="button"
            className="mt-2 inline-flex items-center rounded-md bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            onClick={() => workspaceContext.closeWorkspaceFile(activeFilePath)}
          >
            关闭该标签页
          </button>
        )}
      </div>
    )
  }
  if (content === undefined) return <EditorLoading label="正在读取代码…" />
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <Breadcrumb
        className="shrink-0 px-4 pt-2 pb-1.5 border-b border-[#f0efed] bg-white"
        aria-label="当前代码文件路径"
      >
        <BreadcrumbList className="text-xs">
          {breadcrumbSegments.map((segment, index) => {
            const isLast = index === breadcrumbSegments.length - 1
            return (
              <Fragment key={index}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem className="min-w-0">
                  {isLast ? (
                    <BreadcrumbPage
                      className="cursor-pointer truncate rounded-md px-1.5 py-0.5 max-w-64 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
                      onClick={() => handleLocate(segment.path)}
                    >
                      {segment.name}
                    </BreadcrumbPage>
                  ) : (
                    <span
                      className="cursor-pointer truncate rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors max-w-48"
                      onClick={() => handleLocate(segment.path)}
                    >
                      {segment.name}
                    </span>
                  )}
                </BreadcrumbItem>
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div
        ref={containerRef}
        data-vessel-scroll="code"
        className="vessel-code-editor relative min-h-0 flex-1"
      >
        <Editor
          theme={dark ? "vessel-dark" : "light"}
          beforeMount={registerMonacoTheme}
          height="100%"
          path={monaco.Uri.file(activeFilePath).toString()}
          language={codeLanguage(activeFilePath) || "plaintext"}
          value={content}
          loading={<EditorLoading label="正在加载代码编辑器…" />}
          onChange={(value) => {
            if (value !== undefined && value !== content) {
              setContent(value)
              save(value)
            }
          }}
          onMount={(editor) => {
            editorRef.current = editor
            codeEditors.set(activeFilePath, editor)
            reveal()
            editor.onDidFocusEditorText(() => codeEditors.set(activeFilePath, editor))
            editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => save(editor.getValue()))
          }}
          options={{
            automaticLayout: true,
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            minimap: { enabled: false },
            fontSize: 14,
            scrollBeyondLastLine: false,
            tabSize: 2,
            renderWhitespace: "selection"
          }}
        />
        {goto && (
          <div
            role="dialog"
            aria-label="跳转到行"
            className={`code-goto ${valid ? "" : "code-goto-error"}`}
          >
            <div className="code-goto-row">
              <Hash
                size={20}
                className="shrink-0 text-stone-400"
              />
              <input
                ref={inputRef}
                aria-label="行号或行号:列号"
                value={lineInput}
                onChange={(event) => setLineInput(event.target.value)}
                placeholder="行:列，例如 12:20"
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault()
                    event.stopPropagation()
                    closeGoto()
                  }
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!valid) return
                    editorRef.current?.setPosition({ lineNumber: line, column })
                    editorRef.current?.revealLineInCenter(line, monaco.editor.ScrollType.Smooth)
                    closeGoto()
                  }
                }}
              />
              <span>共 {totalLines} 行</span>
            </div>
            <div className="code-goto-hint">
              <Kbd>Enter</Kbd> 跳转 <Kbd>Esc</Kbd> 关闭{" "}
              <span
                role="status"
                className={valid ? "text-green-700" : "text-red-600"}
              >
                {valid ? `→ 跳转至 第 ${line} 行${column > 1 ? `，第 ${column} 列` : ""}` : `请输入有效行列（1–${totalLines} 行）`}
              </span>
            </div>
          </div>
        )}
      </div>
      <StatusSlot>
        <footer className="flex shrink-0 flex-wrap items-center gap-5 bg-transparent px-2 py-1 text-xs text-stone-500">
          <span
            role={saveError ? "alert" : "status"}
            className={`mr-auto ${saveError ? "text-red-500" : ""}`}
          >
            {status}
          </span>
          {diagnosticError && (
            <span
              role="alert"
              className="text-amber-600"
            >
              {diagnosticError}
            </span>
          )}
          <span>{stats.words.toLocaleString()} 词</span>
          <span>{stats.characters.toLocaleString()} 字符</span>
          <span>{stats.lines.toLocaleString()} 行</span>
          <span>{codeLanguage(activeFilePath) || "plaintext"} · UTF-8</span>
        </footer>
      </StatusSlot>
    </div>
  )
}
