import { SheetOverlay } from "@/components/ui/sheet/components/sheet-overlay"
import { SheetContentProps, SheetPortal, sheetVariants } from "@/components/ui/sheet/components/sheet-shared"
import { cn } from "@/lib/utils"
import * as SheetPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import * as React from "react"

/** Renders the sheet content component. */
export const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(({ side = "right", showOverlay = true, showCloseButton = true, className, children, ...props }, ref) => (
  <SheetPortal>
    {showOverlay && <SheetOverlay />}
    <SheetPrimitive.Content
      ref={ref}
      className={cn(sheetVariants({ side }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <SheetPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      )}
    </SheetPrimitive.Content>
  </SheetPortal>
))

SheetContent.displayName = SheetPrimitive.Content.displayName
