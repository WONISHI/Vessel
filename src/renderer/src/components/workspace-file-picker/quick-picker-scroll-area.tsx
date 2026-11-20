import "./quick-picker-scroll-area.css"
import type { ComponentProps } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

/** All quick pickers share the same contained Radix viewport and scrollbar. */
export function QuickPickerScrollArea({ className, ...props }: ComponentProps<typeof ScrollArea>) {
  return <ScrollArea type="hover" scrollHideDelay={300} {...props} className={cn("quick-picker-scroll", className)} />
}
