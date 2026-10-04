import "./resize-handle.css"
import { Group, Panel, Separator } from "react-resizable-panels"
import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"
export const ResizablePanel = Panel
export function ResizablePanelGroup(props: ComponentProps<typeof Group>) {
  return <Group {...props} className={cn("min-h-0 min-w-0 flex-1", props.className)} />
}
export function ResizableHandle(props: ComponentProps<typeof Separator>) {
  return <Separator {...props} onPointerDownCapture={event => { event.currentTarget.setPointerCapture(event.pointerId); props.onPointerDownCapture?.(event) }} className={cn("vessel-resize-handle vessel-panel-separator", props.className)} />
}
