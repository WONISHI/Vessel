import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card"
import { useEffect, useRef, useState, type RefObject } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { PreviewBody } from "./section-preview"

export function WikiLinkPreview({ host, workspacePath }: { host: RefObject<HTMLDivElement | null>; workspacePath: string }) {
  const [preview, setPreview] = useState<{ rect: DOMRect; target: string; content?: string; path?: string; error?: string } | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const generation = useRef(0)
  const insideCard = useRef(false)
  const activeTarget = useRef<string | null>(null)
  const keepOpen = () => clearTimeout(closeTimer.current)
  const closeSoon = () => {
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => { if (!insideCard.current) { generation.current++; activeTarget.current = null; setPreview(null) } }, 300)
  }
  useEffect(() => {
    const root = host.current
    if (!root) return
    let timer: ReturnType<typeof setTimeout>
    let hovered: HTMLElement | null = null
    const enter = (event: MouseEvent) => {
      const element = (event.target as Element).closest<HTMLElement>("[data-wiki-target]")
      if (!element || !root.contains(element)) return
      keepOpen()
      if (element === hovered) return
      if (hovered?.dataset.wikiTarget === element.dataset.wikiTarget) { hovered = element; return }
      hovered = element
      if (activeTarget.current === element.dataset.wikiTarget) return
      clearTimeout(timer)
      const request = ++generation.current
      timer = setTimeout(() => {
        const target = element.dataset.wikiTarget!
        activeTarget.current = target
        setPreview({ rect: element.getBoundingClientRect(), target })
        void window.electronAPI.readWikiLink(workspacePath, target).then(result => {
          if (generation.current === request) setPreview({ rect: element.getBoundingClientRect(), target, content: result.content, path: result.path })
        }).catch(error => { if (generation.current === request) setPreview({ rect: element.getBoundingClientRect(), target, error: String(error) }) })
      }, 1500)
    }
    const leave = (event: MouseEvent) => {
      if (!hovered || !hovered.contains(event.target as Node) || hovered.contains(event.relatedTarget as Node)) return
      clearTimeout(timer)
      hovered = null
      if (!(event.relatedTarget as Element | null)?.closest?.("[data-wiki-preview]")) closeSoon()
    }
    root.addEventListener("mouseover", enter)
    root.addEventListener("mouseout", leave)
    return () => { clearTimeout(timer); clearTimeout(closeTimer.current); generation.current++; root.removeEventListener("mouseover", enter); root.removeEventListener("mouseout", leave) }
  }, [host, workspacePath])
  return <HoverCard open={Boolean(preview)} >
    <HoverCardTrigger asChild><span aria-hidden style={{ position: "fixed", pointerEvents: "none", left: preview?.rect.left ?? 0, top: preview?.rect.top ?? 0, width: preview?.rect.width ?? 0, height: preview?.rect.height ?? 0 }} /></HoverCardTrigger>
    <HoverCardPortal><HoverCardContent data-wiki-preview side="top" onMouseEnter={() => { insideCard.current = true; keepOpen() }} onMouseLeave={(event) => {
      if ((event.relatedTarget as Element | null)?.closest?.("[data-wiki-preview]")) return
      insideCard.current = false; closeSoon()
    }} onEscapeKeyDown={() => { generation.current++; activeTarget.current = null; setPreview(null) }} className="w-[min(480px,80vw)]">
      <p className="mb-2 text-center font-semibold">{preview?.target}</p>
      {preview?.error ? <p className="text-red-500">找不到或无法读取链接文件：{preview.error}</p> : preview?.content !== undefined ? <PreviewBody source={preview.content} workspacePath={workspacePath} documentPath={preview.path!} /> : <p>正在读取…</p>}
    </HoverCardContent></HoverCardPortal>
  </HoverCard>
}
