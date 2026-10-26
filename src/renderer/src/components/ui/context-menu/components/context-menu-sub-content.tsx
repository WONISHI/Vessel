import { cn } from "@/lib/utils"
import * as Primitive from "@radix-ui/react-context-menu"
import * as React from "react"

/** Renders the context menu sub content component. */
export const ContextMenuSubContent = React.forwardRef<React.ElementRef<typeof Primitive.SubContent>, React.ComponentPropsWithoutRef<typeof Primitive.SubContent>>(({ className, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.SubContent
      data-radix-context-menu-content=""
      ref={ref}
      className={cn("z-[250] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-md", className)}
      {...props}
    />
  </Primitive.Portal>
))

ContextMenuSubContent.displayName = "ContextMenuSubContent"
