import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Renders the kbd group component. */
export function KbdGroup({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1 whitespace-nowrap", className)}
      {...props}
    />
  )
}
