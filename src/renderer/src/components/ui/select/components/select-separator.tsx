import { cn } from "@/lib/utils"
import * as SelectPrimitive from "@radix-ui/react-select"
import * as React from "react"

/** Renders the select separator component. */
export const SelectSeparator = React.forwardRef<React.ElementRef<typeof SelectPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))

SelectSeparator.displayName = SelectPrimitive.Separator.displayName
