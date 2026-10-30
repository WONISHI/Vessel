import { ContextMenuTrigger } from "@/components/ui/context-menu"
import { useLayoutEffect, useRef } from "react"

/** Open Radix's context menu at the editor's saved pointer/caret position. */
export function MarkdownContextMenuAnchor({ x, y, label }: { x: number; y: number; label: string }) {
  const trigger = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    trigger.current?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: x, clientY: y }))
  }, [x, y])
  return <ContextMenuTrigger ref={trigger} aria-label={label} style={{ position: "fixed", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }} />
}
