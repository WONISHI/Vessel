import { cn } from "@/lib/utils"
import * as Primitive from "@radix-ui/react-context-menu"
import * as React from "react"

/** Renders the context menu separator component. */
export const ContextMenuSeparator = React.forwardRef<React.ElementRef<typeof Primitive.Separator>, React.ComponentPropsWithoutRef<typeof Primitive.Separator>>(({ className, ...props }, ref) => (
  <Primitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-stone-200", className)}
    {...props}
  />
))

ContextMenuSeparator.displayName = "ContextMenuSeparator"
