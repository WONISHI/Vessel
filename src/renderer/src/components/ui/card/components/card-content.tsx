import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the card content component. */
export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    {...props}
  />
))

CardContent.displayName = "CardContent"
