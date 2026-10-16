import { cn } from "@/lib/utils"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import * as React from "react"

/** Renders the avatar image component. */
export const AvatarImage = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Image>, React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))

AvatarImage.displayName = AvatarPrimitive.Image.displayName
