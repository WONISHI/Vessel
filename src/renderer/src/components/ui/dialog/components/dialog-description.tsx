import { cn } from "@/lib/utils"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as React from "react"

/** Renders the dialog description component. */
export const DialogDescription = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Description>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))

DialogDescription.displayName = DialogPrimitive.Description.displayName
