import { cn } from "@/lib/utils"
import { Command as CommandPrimitive } from "cmdk"
import * as React from "react"

/** Renders the command component. */
export const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn("flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground", className)}
    {...props}
  />
))

Command.displayName = CommandPrimitive.displayName
