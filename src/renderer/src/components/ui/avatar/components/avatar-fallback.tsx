import { cn } from "@/lib/utils"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as React from "react"

/** Renders the avatar fallback component. */
export const AvatarFallback = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Fallback>, React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}
    {...props}
  />
))

AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName
