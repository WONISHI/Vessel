import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import * as React from "react"

/** Renders the alert dialog cancel component. */
export const AlertDialogCancel = React.forwardRef<React.ElementRef<typeof AlertDialogPrimitive.Cancel>, React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
))

AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName
