import { cn } from "@/lib/utils"
import { type ComponentProps } from "react"
import { Group } from "react-resizable-panels"

/** Renders the resizable panel group component. */
export function ResizablePanelGroup(props: ComponentProps<typeof Group>) {
  return (
    <Group
      {...props}
      className={cn("min-h-0 min-w-0 flex-1", props.className)}
    />
  )
}
