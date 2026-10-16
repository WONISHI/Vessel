import { cn } from "@/lib/utils"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import * as React from "react"

/** Renders the tabs list component. */
export const TabsList = React.forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
    {...props}
  />
))

TabsList.displayName = TabsPrimitive.List.displayName
