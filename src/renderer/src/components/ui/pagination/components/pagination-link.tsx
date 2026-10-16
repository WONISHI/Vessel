import { buttonVariants } from "@/components/ui/button"
import { PaginationLinkProps } from "@/components/ui/pagination/components/pagination-shared"
import { cn } from "@/lib/utils"

/** Renders the pagination link component. */
export function PaginationLink({ className, isActive, size = "icon", ...props }: PaginationLinkProps) {
  return (
    <a
      aria-current={isActive ? "page" : undefined}
      className={cn(buttonVariants({ variant: isActive ? "outline" : "ghost", size }), className)}
      {...props}
    />
  )
}
