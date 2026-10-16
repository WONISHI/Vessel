import { PaginationLink } from "@/components/ui/pagination/components/pagination-link"
import { ChevronLeft } from "lucide-react"
import * as React from "react"

/** Renders the pagination previous component. */
export function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="上一页"
      className={className}
      {...props}
    >
      <ChevronLeft className="h-4 w-4" />
      <span className="sr-only">上一页</span>
    </PaginationLink>
  )
}
