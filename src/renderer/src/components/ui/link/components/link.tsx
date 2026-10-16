import { LinkInteractionArea } from "@/components/ui/link/components/link-interaction-area"
import { LinkProps, linkClassName } from "@/components/ui/link/components/link-shared"
import { cn } from "@/lib/utils"
import { forwardRef } from "react"

/** Renders the link component. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ actions, className, ...props }, ref) => (
  <LinkInteractionArea
    inline
    actions={actions}
    className="contents"
  >
    <a
      ref={ref}
      className={cn(linkClassName, className)}
      {...props}
    />
  </LinkInteractionArea>
))

Link.displayName = "Link"
