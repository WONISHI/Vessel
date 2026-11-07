import { Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { lazy, Suspense, useEffect, useRef, useState, type RefObject } from "react"
import { parseFootnotes } from "@vessel/obsidian"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Portal } from "@radix-ui/react-hover-card"

const PreviewBody = lazy(() => import("./section-preview/components/preview-body").then((module) => ({ default: module.PreviewBody })))

type Note = { id: string; title: string; number: number; content: string; rect: DOMRect }
export function FootnoteHoverCard({ host, source, onDelete, workspacePath = "", documentPath = "" }: { workspacePath?: string; documentPath?: string; host: RefObject<HTMLDivElement | null>; source: () => string; onDelete?: (id: string) => void }) {
  const deleteRef = useRef(onDelete)
  useEffect(() => {
    deleteRef.current = onDelete
  }, [onDelete])
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const sourceRef = useRef(source)
  useEffect(() => {
    sourceRef.current = source
  }, [source])
  const [note, setNote] = useState<Note | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const keep = () => clearTimeout(closeTimer.current)
  const close = () => {
    keep()
    closeTimer.current = setTimeout(() => setNote(null), 180)
  }
  useEffect(() => {
    const root = host.current
    if (!root) return
    const show = (event: Event) => {
      const target = (event.target as Element)?.closest<HTMLElement>('[data-vessel-footnote-id], sup[data-type="footnotes-ref"]')
      if (!target || target.closest('[data-type="footnotes-block"], [data-type="code-block"]')) return
      const id = target.dataset.vesselFootnoteId || target.getAttribute("data-footnotes-label")?.replace(/^\^/, "")
      const parsed = parseFootnotes(sourceRef.current())
      const definition = parsed.definitions.find((item) => item.id === id)
      if (!definition) return
      keep()
      const scope = target.closest(".vditor-ir") ?? root
      const boundText = Array.from(scope.querySelectorAll<HTMLElement>("[data-vessel-footnote-id]"))
        .filter((node) => node.dataset.vesselFootnoteId === id)
        .map((node) => node.textContent ?? "").join("")
        .replace(/[\u200b\ufeff]/g, "").trim()
      const orderedIds = [...new Set([...parsed.references, ...parsed.annotations]
        .sort((a, b) => a.start - b.start)
        .filter((entry) => parsed.definitions.some((definition) => definition.id === entry.id))
        .map((entry) => entry.id))]
      setNote({
        id: definition.id,
        title: boundText || parsed.annotations.filter((entry) => entry.id === id).map((entry) => entry.content).join("") || "脚注",
        number: orderedIds.indexOf(definition.id) + 1 || parsed.definitions.indexOf(definition) + 1,
        content: definition.content,
        rect: target.getBoundingClientRect()
      })
    }
    const leave = (event: Event) => {
      const target = (event.target as Element)?.closest('[data-vessel-footnote-id], sup[data-type="footnotes-ref"]')
      if (!target || target.contains((event as PointerEvent).relatedTarget as Node)) return
      close()
    }
    const context = (event: MouseEvent) => {
      if (!deleteRef.current) return
      const target = (event.target as Element)?.closest<HTMLElement>('[data-vessel-footnote-id], sup[data-type="footnotes-ref"]')
      const id = target?.dataset.vesselFootnoteId || target?.getAttribute("data-footnotes-label")?.replace(/^\^/, "")
      if (!id) return
      event.preventDefault()
      event.stopPropagation()
      keep()
      setNote(null)
      setMenu({ id, x: event.clientX, y: event.clientY })
    }
    root.addEventListener("contextmenu", context, true)
    root.addEventListener("pointerover", show)
    root.addEventListener("focusin", show)
    root.addEventListener("pointerout", leave)
    root.addEventListener("focusout", leave)
    return () => {
      keep()
      root.removeEventListener("contextmenu", context, true)
      root.removeEventListener("pointerover", show)
      root.removeEventListener("pointerout", leave)
      root.removeEventListener("focusin", show)
      root.removeEventListener("focusout", leave)
    }
  }, [host])
  return (
    <>
      <HoverCard
        open={!!note}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        openDelay={150}
        closeDelay={180}
      >
        <HoverCardTrigger asChild>
          <span
            aria-hidden
            className="pointer-events-none fixed"
            style={{ left: note?.rect.left ?? 0, top: note?.rect.top ?? 0, width: note?.rect.width ?? 0, height: note?.rect.height ?? 0 }}
          />
        </HoverCardTrigger>
        <Portal>
          <HoverCardContent
            side="bottom"
            align="start"
            sideOffset={7}
            collisionPadding={12}
            className="z-[100] w-[min(480px,calc(100vw-24px))] max-w-[calc(100vw-24px)] rounded-xl p-3"
            onContextMenu={(event) => {
              if (!note || !onDelete) return
              event.preventDefault()
              event.stopPropagation()
              keep()
              setMenu({ id: note.id, x: event.clientX, y: event.clientY })
              setNote(null)
            }}
            onPointerEnter={keep}
            onPointerLeave={close}
            onFocusCapture={keep}
            onBlurCapture={close}
          >
            <div className="mb-1.5 flex min-w-0 items-center gap-2">
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-green-100 px-1.5 text-[10px] font-semibold text-green-700 dark:bg-green-950 dark:text-green-300">{note?.number}</span>
              <span className="truncate text-xs font-medium" title={note?.title}>{note?.title}</span>
            </div>
            {note && (
              <Suspense fallback={<p className="text-xs text-muted-foreground">正在加载…</p>}>
                <PreviewBody key={note.id} source={note.content} workspacePath={workspacePath} documentPath={documentPath} />
              </Suspense>
            )}
          </HoverCardContent>
        </Portal>
      </HoverCard>
      {menu && onDelete && (
        <DropdownMenu
          open
          modal={false}
          onOpenChange={(open) => {
            if (!open) setMenu(null)
          }}
        >
          <DropdownMenuTrigger
            aria-label="脚注操作"
            style={{ position: "fixed", left: menu.x, top: menu.y, width: 0, height: 0, pointerEvents: "none" }}
          />
          <DropdownMenuContent
            align="start"
            sideOffset={4}
            collisionPadding={8}
            className="z-[260] w-36 rounded-lg p-1"
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <DropdownMenuItem
              className="rounded-md text-xs text-red-600 focus:bg-red-50 focus:text-red-600 dark:text-red-400 dark:focus:bg-red-950 dark:focus:text-red-300"
              onSelect={() => {
                const id = menu.id
                setMenu(null)
                onDelete(id)
              }}
            >
              <Trash2 className="size-3.5" />
              删除脚注
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  )
}
