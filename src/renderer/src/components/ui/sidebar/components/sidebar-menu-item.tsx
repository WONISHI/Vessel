import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the sidebar menu item component. */
export const SidebarMenuItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
))

SidebarMenuItem.displayName = "SidebarMenuItem"
