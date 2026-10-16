import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the breadcrumb item component. */
export const BreadcrumbItem = React.forwardRef<HTMLLIElement, React.ComponentPropsWithoutRef<"li">>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props}
  />
))

BreadcrumbItem.displayName = "BreadcrumbItem"
