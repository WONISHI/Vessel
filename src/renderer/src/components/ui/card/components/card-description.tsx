import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the card description component. */
export const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-zinc-500", className)}
    {...props}
  />
))

CardDescription.displayName = "CardDescription"
