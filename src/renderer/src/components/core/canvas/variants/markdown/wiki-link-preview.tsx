import { Portal as HoverCardPortal } from "@radix-ui/react-hover-card"
import { useEffect, useState, type RefObject } from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { PreviewBody } from "./section-preview"

export function WikiLinkPreview({ host, workspacePath }: { host: RefObject<HTMLDivElement | null>; workspacePath: string }) {
  const [preview, setPreview] = useState<{ rect: DOMRect; target: string; content?: string; error?: string } | null>(null)
  useEffect(() => {
    const root = host.current
    if (!root) return
    let timer: ReturnType<typeof setTimeout>
    let generation = 0
    let hovered: HTMLElement | null = null
    const enter = (event: MouseEvent) => {
      const element = (event.target as Element).closest<HTMLElement>("[data-wiki-target]")
      if (!element || element === hovered) return
      hovered = element
      clearTimeout(timer)
      const request = ++generation
      timer = setTimeout(() => {
        const target = element.dataset.wikiTarget!
        setPreview({ rect: element.getBoundingClientRect(), target })
        void window.electronAPI.readWikiLink(workspacePath, target).then(result => {
          if (generation === request) setPreview({ rect: element.getBoundingClientRect(), target, content: result.content })
        }).catch(error => { if (generation === request) setPreview({ rect: element.getBoundingClientRect(), target, error: String(error) }) })
      }, 3000)
    }
    const leave = (event: MouseEvent) => {
      if (hovered?.contains(event.relatedTarget as Node)) return
      clearTimeout(timer)
      hovered = null
      if (!(event.relatedTarget as Element | null)?.closest?.("[data-wiki-preview]")) { generation++; setPreview(null) }
    }
    root.addEventListener("mouseover", enter)
    root.addEventListener("mouseout", leave)
    return () => { clearTimeout(timer); generation++; root.removeEventListener("mouseover", enter); root.removeEventListener("mouseout", leave) }
  }, [host, workspacePath])
  return <HoverCard open={Boolean(preview)} onOpenChange={open => { if (!open) setPreview(null) }}>
    <HoverCardTrigger asChild><span aria-hidden style={{ position: "fixed", pointerEvents: "none", left: preview?.rect.left ?? 0, top: preview?.rect.top ?? 0, width: preview?.rect.width ?? 0, height: preview?.rect.height ?? 0 }} /></HoverCardTrigger>
    <HoverCardPortal><HoverCardContent data-wiki-preview side="top" onMouseLeave={() => setPreview(null)} className="w-[min(480px,80vw)]">
      <p className="mb-2 font-semibold">{preview?.target}</p>
      {preview?.error ? <p className="text-red-500">找不到或无法读取链接文件：{preview.error}</p> : preview?.content !== undefined ? <PreviewBody source={preview.content} /> : <p>正在读取…</p>}
    </HoverCardContent></HoverCardPortal>
  </HoverCard>
}
