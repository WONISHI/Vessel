import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the card footer component. */
export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))

CardFooter.displayName = "CardFooter"
