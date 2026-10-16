import { cn } from "@/lib/utils"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import * as React from "react"

/** Renders the sheet description component. */
export const SheetDescription = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Description>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))

SheetDescription.displayName = SheetPrimitive.Description.displayName
