import { cn } from "@/lib/utils"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import * as React from "react"

/** Renders the alert dialog title component. */
export const AlertDialogTitle = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold", className)}
    {...props}
  />
))

AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName
