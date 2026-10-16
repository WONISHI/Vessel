import * as React from "react"

/** Renders the sidebar menu sub item component. */
export const SidebarMenuSubItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ ...props }, ref) => (
  <li
    ref={ref}
    {...props}
  />
))

SidebarMenuSubItem.displayName = "SidebarMenuSubItem"
