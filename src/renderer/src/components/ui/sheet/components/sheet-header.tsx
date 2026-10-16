import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the sheet header component. */
export const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
)

SheetHeader.displayName = "SheetHeader"
