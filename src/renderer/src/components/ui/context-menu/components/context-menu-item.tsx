import { cn } from "@/lib/utils"
import * as Primitive from "@radix-ui/react-context-menu"
import * as React from "react"

/** Renders the context menu item component. */
export const ContextMenuItem = React.forwardRef<React.ElementRef<typeof Primitive.Item>, React.ComponentPropsWithoutRef<typeof Primitive.Item>>(({ className, ...props }, ref) => (
  <Primitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-green-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0",
      className
    )}
    {...props}
  />
))

ContextMenuItem.displayName = "ContextMenuItem"
