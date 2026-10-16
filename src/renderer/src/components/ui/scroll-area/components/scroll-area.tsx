import { ScrollBar } from "@/components/ui/scroll-area/components/scroll-bar"
import { cn } from "@/lib/utils"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"
import * as React from "react"

/** Renders the scroll area component. */
export const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & { viewportRef?: React.Ref<HTMLDivElement> }>(({ className, children, viewportRef, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
    data-vessel-scroll="area"
  >
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      className="h-full w-full rounded-[inherit]"
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))

ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName
