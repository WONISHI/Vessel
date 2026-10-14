import { useExternalContent } from "@/pages/workspace/hooks/file-changes"
import { headingSections } from "./heading-sections"
import { WikiLinkPreview } from "./wiki-link-preview"
import { DocumentStats } from "./document-stats"
import { outlineHeading } from "./outline-heading"
import { PageLoading } from "@/components/ui/page-loading"
import { useContext, Suspense } from "react"
import { WorkspaceContext } from "@/pages/workspace/types/workspace"
import { useEffect, useMemo, useRef, useState } from "react"
import { DocumentOutline } from "./document-outline"
import { highlightKeywordInVditor } from "@/pages/search/reveal-hit"
import { VditorEditor } from "./vditor-editor"
import "./index.css"
import { lazyWithRetry } from "@/lib/lazy-retry"

const ExcalidrawCanvas = lazyWithRetry(() => import("@/components/core/canvas/variants/excalidraw"))

/** 即时编辑文档；基于实际渲染标题同步大纲和滚动位置。 */
export default function MarkdownCanvas({ activeFilePath, workspacePath: customWorkspacePath, highlightKeyword, revealLine }: { activeFilePath: string; workspacePath?: string; highlightKeyword?: string; revealLine?: number }) {
  const context = useContext(WorkspaceContext)
  const workspacePath = customWorkspacePath || context?.workspace.path || ""
  const [loaded, setLoaded] = useState<{ path: string; content: string; error?: string } | null>(null)
  const [saveState, setSaveState] = useState<{ path: string; message: string; failed?: boolean } | null>(null)
  const [asExcalidraw, setAsExcalidraw] = useState(false)
  const saveRevision = useRef(0)
  const drafts = useRef(new Map<string, string>())
  const contentHost = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let cancelled = false
    const cached = drafts.current.get(activeFilePath)
    const request = cached === undefined ? window.electronAPI.readContent(activeFilePath) : Promise.resolve(cached)
    request
      .then((content) => {
        if (!cancelled) setLoaded({ path: activeFilePath, content })
      })
      .catch((error) => {
        if (!cancelled) setLoaded({ path: activeFilePath, content: "", error: String(error) })
      })
    return () => {
      cancelled = true
    }
  }, [activeFilePath])
  const [externalRevision, setExternalRevision] = useState(0)
  useExternalContent(activeFilePath, loaded?.path === activeFilePath ? loaded.content : undefined, content => {
    drafts.current.set(activeFilePath, content)
    setLoaded({ path: activeFilePath, content })
    setExternalRevision(value => value + 1)
    setSaveState({ path: activeFilePath, message: "已从磁盘更新" })
  })
  const current = loaded?.path === activeFilePath ? loaded : null
  const sections = useMemo(() => headingSections(current?.content ?? ""), [current?.content])
  const [headings, setHeadings] = useState<{ text: string; level: number; color?: string }[]>([])
  const [activeHeading, setActiveHeading] = useState(-1)
  useEffect(() => {
    const host = contentHost.current
    if (!host) return
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nodes = Array.from(host.querySelectorAll<HTMLElement>(".vditor-ir .vditor-reset h1, .vditor-ir .vditor-reset h2, .vditor-ir .vditor-reset h3, .vditor-ir .vditor-reset h4, .vditor-ir .vditor-reset h5, .vditor-ir .vditor-reset h6"))
        const next = nodes.map((node) => {
          return { ...outlineHeading(node.textContent ?? ""), level: Number(node.tagName[1]) }
        })
        setHeadings((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next))
        const bounds = host.getBoundingClientRect()
        const center = bounds.top + bounds.height / 2
        let active = nodes.length ? 0 : -1
        nodes.forEach((node, index) => {
          if (node.getBoundingClientRect().top <= center) active = index
        })
        setActiveHeading(active)
      })
    }
    const observer = new MutationObserver(update)
    observer.observe(host, { childList: true, subtree: true, characterData: true })
    const resize = new ResizeObserver(update)
    resize.observe(host)
    host.addEventListener("scroll", update, true)
    update()
    return () => {
      observer.disconnect()
      resize.disconnect()
      host.removeEventListener("scroll", update, true)
      cancelAnimationFrame(frame)
    }
  }, [activeFilePath])

  useEffect(() => {
    if (!highlightKeyword || !highlightKeyword.trim()) return
    const host = contentHost.current
    if (!host) return
    let tries = 0
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const editor = host.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      if (!editor) {
        if (++tries < 30) timer = setTimeout(attempt, 100)
        return
      }
      highlightKeywordInVditor(editor, highlightKeyword)
    }
    timer = setTimeout(attempt, 120)
    return () => clearTimeout(timer)
  }, [highlightKeyword, revealLine, activeFilePath, externalRevision])

  const hasExcalidraw = Boolean(
    current?.content &&
      (current.content.includes("excalidraw-plugin: parsed") ||
        current.content.includes("# Excalidraw Data"))
  )

  if (hasExcalidraw && asExcalidraw) {
    return (
      <Suspense fallback={<PageLoading label="正在载入白板…" />}>
        <ExcalidrawCanvas activeFilePath={activeFilePath} workspacePath={workspacePath} />
      </Suspense>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      {hasExcalidraw && (
        <div className="flex h-8 shrink-0 items-center justify-between border-b border-emerald-100 bg-emerald-50 px-4 text-xs text-emerald-800">
          <span className="flex items-center gap-1.5 font-medium">
            <span>🎨</span>
            <span>当前文档包含 Excalidraw 白板绘图</span>
          </span>
          <button
            onClick={() => setAsExcalidraw(true)}
            className="rounded bg-emerald-600 px-2.5 py-0.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            切换为白板视图
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div
          ref={contentHost}
          className="min-h-0 min-w-0 flex-1"
        >
          {!current ? (
            <PageLoading label="正在读取文档…" />
          ) : current.error ? (
            <p
              role="alert"
              className="p-6 text-sm text-red-500"
            >
              读取文件失败：{current.error}
            </p>
          ) : (
            <VditorEditor
              key={`${activeFilePath}:${externalRevision}`}
              workspacePath={workspacePath}
              documentPath={activeFilePath}
              value={current.content}
              onChange={(content) => {
                drafts.current.set(activeFilePath, content)
                setLoaded({ path: activeFilePath, content })
                const revision = ++saveRevision.current
                setSaveState({ path: activeFilePath, message: "正在保存…" })
                void window.electronAPI.saveContent(activeFilePath, content).then(() => {
                  if (revision === saveRevision.current) setSaveState({ path: activeFilePath, message: "已保存" })
                }).catch(error => {
                  if (revision === saveRevision.current) setSaveState({ path: activeFilePath, message: `保存失败：${String(error)}`, failed: true })
                })
              }}
            />
          )}
        </div>
        <DocumentOutline
          workspacePath={workspacePath}
          documentPath={activeFilePath}
          sections={sections}
          fileName={activeFilePath.split(/[\\/]/).pop()}
          headings={headings}
          activeIndex={activeHeading}
          onSelect={(index) => {
            const nodes = contentHost.current?.querySelectorAll(".vditor-ir .vditor-reset :is(h1,h2,h3,h4,h5,h6)")
            nodes?.[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
          }}
        />
      </div>
      <WikiLinkPreview key={`${activeFilePath}:${externalRevision}`} host={contentHost} workspacePath={workspacePath} />
      <DocumentStats source={current?.content ?? ""} saveStatus={saveState?.path === activeFilePath ? saveState : undefined} />
    </div>
  )
}
