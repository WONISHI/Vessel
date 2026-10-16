import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the card title component. */
export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))

CardTitle.displayName = "CardTitle"
