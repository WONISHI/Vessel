import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the table caption component. */
export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-stone-500", className)}
    {...props}
  />
))

TableCaption.displayName = "TableCaption"
