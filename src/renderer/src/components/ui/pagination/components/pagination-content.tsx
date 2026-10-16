import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the pagination content component. */
export const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))

PaginationContent.displayName = "PaginationContent"
