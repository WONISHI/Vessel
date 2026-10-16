import { PaginationLink } from "@/components/ui/pagination/components/pagination-link"
import { ChevronRight } from "lucide-react"
import * as React from "react"

/** Renders the pagination next component. */
export function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
  return (
    <PaginationLink
      aria-label="下一页"
      className={className}
      {...props}
    >
      <ChevronRight className="h-4 w-4" />
      <span className="sr-only">下一页</span>
    </PaginationLink>
  )
}
