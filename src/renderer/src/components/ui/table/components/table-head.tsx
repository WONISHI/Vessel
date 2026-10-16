import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the table head component. */
export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn("h-10 px-3 text-left align-middle font-medium text-stone-500 [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))

TableHead.displayName = "TableHead"
