import { cn } from "@/lib/utils"
import * as Primitive from "@radix-ui/react-context-menu"
import * as React from "react"

/** Renders the context menu content component. */
export const ContextMenuContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, React.ComponentPropsWithoutRef<typeof Primitive.Content>>(({ className, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Content
      ref={ref}
      className={cn("z-[250] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md", className)}
      {...props}
    />
  </Primitive.Portal>
))

ContextMenuContent.displayName = "ContextMenuContent"
