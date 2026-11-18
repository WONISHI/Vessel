import { cn } from "@/lib/utils"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import * as React from "react"

/** Renders the sheet overlay component. */
export const SheetOverlay = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn("fixed inset-0 z-50 bg-black/[.04] backdrop-blur-[3px]  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
    ref={ref}
  />
))

SheetOverlay.displayName = SheetPrimitive.Overlay.displayName
