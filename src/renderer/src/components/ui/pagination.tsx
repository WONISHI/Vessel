import * as React from "react"
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants, type ButtonProps } from "@/components/ui/button"

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="分页"
      className={cn("mx-auto flex w-full justify-center", className)}
      {...props}
    />
  )
}
const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<"ul">>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn("flex flex-row items-center gap-1", className)}
    {...props}
  />
))
PaginationContent.displayName = "PaginationContent"
const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<"li">>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={className}
    {...props}
  />
))
PaginationItem.displayName = "PaginationItem"
type PaginationLinkProps = { isActive?: boolean } & Pick<ButtonProps, "size"> & React.ComponentProps<"a">
function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  )
}
function PaginationPrevious({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
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
function PaginationNext({ className, ...props }: React.ComponentProps<typeof PaginationLink>) {
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
function PaginationEllipsis({ className, ...props }: React.ComponentProps<"span">) {
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
export { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis }
