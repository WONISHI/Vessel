import { Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useEffect, useRef, useState, type RefObject } from "react"
import { parseFootnotes } from "@vessel/obsidian"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Portal } from "@radix-ui/react-hover-card"

type Note = { id: string; content: string; rect: DOMRect }
export function FootnoteHoverCard({ host, source, onDelete }: { host: RefObject<HTMLDivElement | null>; source: () => string; onDelete?: (id: string) => void }) {
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
      const definition = parseFootnotes(sourceRef.current()).definitions.find((item) => item.id === id)
      if (!definition) return
      keep()
      setNote({ id: definition.id, content: definition.content, rect: target.getBoundingClientRect() })
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
            className="z-[100] w-72 max-w-[calc(100vw-24px)] rounded-xl p-3"
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
            <div className="mb-1.5 text-[10px] font-medium text-muted-foreground">脚注 {note?.id}</div>
            <div className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-xs leading-6">{note?.content}</div>
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
