import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the sidebar group content component. */
export const SidebarGroupContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))

SidebarGroupContent.displayName = "SidebarGroupContent"
