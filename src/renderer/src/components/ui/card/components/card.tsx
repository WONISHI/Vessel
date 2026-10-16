import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the card component. */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-xl border border-zinc-200/60 bg-white text-zinc-900", className)}
    {...props}
  />
))

Card.displayName = "Card"
