import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the sidebar header component. */
export const SidebarHeader = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})

SidebarHeader.displayName = "SidebarHeader"
