import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the table footer component. */
export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t bg-stone-100/50 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
))

TableFooter.displayName = "TableFooter"
