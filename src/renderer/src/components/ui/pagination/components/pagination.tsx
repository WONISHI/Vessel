import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the pagination component. */
export function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="分页"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}
