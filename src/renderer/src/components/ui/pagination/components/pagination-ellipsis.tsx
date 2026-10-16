import { cn } from "@/lib/utils"
import { MoreHorizontal } from "lucide-react"
import * as React from "react"

/** Renders the pagination ellipsis component. */
export function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn("flex h-10 w-10 items-center justify-center", className)}
      {...props}
    >
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">更多页</span>
    </span>
  )
}
