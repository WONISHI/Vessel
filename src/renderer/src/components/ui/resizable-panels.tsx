import "./resize-handle.css"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useEffect, useRef, type ComponentProps } from "react"
import { cn } from "@/lib/utils"
export const ResizablePanel = Panel
export function ResizablePanelGroup(props: ComponentProps<typeof Group>) {
  return <Group {...props} className={cn("min-h-0 min-w-0 flex-1", props.className)} />
}
export function ResizableHandle(props: ComponentProps<typeof Separator>) {
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])
  return <Separator {...props} onPointerDownCapture={event => {
    if (event.button !== 0) return
    cleanup.current?.()
    // Electron webviews own native pointer surfaces. Suspend their hit testing
    // throughout the drag, including when the pointer crosses into the webpage.
    const style = document.createElement("style")
    style.textContent = "webview, iframe { pointer-events: none !important; }"
    document.head.append(style)
    const stop = () => {
      style.remove()
      window.removeEventListener("pointerup", stop, true)
      window.removeEventListener("pointercancel", stop, true)
      window.removeEventListener("blur", stop)
      cleanup.current = null
    }
    cleanup.current = stop
    window.addEventListener("pointerup", stop, true)
    window.addEventListener("pointercancel", stop, true)
    window.addEventListener("blur", stop)
    event.currentTarget.setPointerCapture(event.pointerId)
    props.onPointerDownCapture?.(event)
  }} className={cn("vessel-resize-handle vessel-panel-separator", props.className)} />
}
