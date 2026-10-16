import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the sidebar footer component. */
export const SidebarFooter = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})

SidebarFooter.displayName = "SidebarFooter"
