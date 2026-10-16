import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import * as React from "react"

/** Renders the alert dialog action component. */
export const AlertDialogAction = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Action>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    className={cn(buttonVariants(), className)}
    {...props}
  />
))

AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName
