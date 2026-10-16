import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the table body component. */
export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))

TableBody.displayName = "TableBody"
