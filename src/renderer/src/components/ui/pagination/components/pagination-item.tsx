import * as React from "react"

/** Renders the pagination item component. */
export const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={className}
    {...props}
  />
))

PaginationItem.displayName = "PaginationItem"
