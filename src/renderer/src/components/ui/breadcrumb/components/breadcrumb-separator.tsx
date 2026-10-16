import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import * as React from "react"

/** Renders the breadcrumb separator component. */
export const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}
  >
    {children ?? <ChevronRight />}
  </li>
)

BreadcrumbSeparator.displayName = "BreadcrumbSeparator"
