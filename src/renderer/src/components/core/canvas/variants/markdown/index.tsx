import { PageLoading } from "@/components/ui/page-loading"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import { useEffect, useRef, useState } from "react"
import { DocumentOutline } from "./document-outline"
import { VditorEditor } from "./vditor-editor"
import "./index.css"

/** 即时编辑文档；基于实际渲染标题同步大纲和滚动位置。 */
export default function MarkdownCanvas({ activeFilePath }: { activeFilePath: string }) {
  const { workspace } = useWorkspace()
  const [loaded, setLoaded] = useState<{ path: string; content: string; error?: string } | null>(null)
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
  const current = loaded?.path === activeFilePath ? loaded : null
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
          // 在惰性 template 中读取标题标记，只提取文本和颜色，不执行或挂载原始 HTML。
          const template = document.createElement("template")
          template.innerHTML = node.textContent?.replace(/^#+\s*/, "") ?? ""
          template.content.querySelectorAll("script,style").forEach((element) => element.remove())
          const styled = template.content.querySelector<HTMLElement>("font[color],span[style]")
          const color = styled?.style.color || styled?.getAttribute("color") || undefined
          return { text: template.content.textContent ?? "", level: Number(node.tagName[1]), color }
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
  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-white">
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
            key={activeFilePath}
            workspacePath={workspace.path}
            documentPath={activeFilePath}
            value={current.content}
            onChange={(content) => {
              drafts.current.set(activeFilePath, content)
              setLoaded({ path: activeFilePath, content })
            }}
          />
        )}
      </div>
      <DocumentOutline
        fileName={activeFilePath.split(/[\\/]/).pop()}
        headings={headings}
        activeIndex={activeHeading}
        onSelect={(index) => {
          const nodes = contentHost.current?.querySelectorAll(".vditor-ir .vditor-reset :is(h1,h2,h3,h4,h5,h6)")
          nodes?.[index]?.scrollIntoView({ behavior: "smooth", block: "center" })
        }}
      />
    </div>
  )
}
