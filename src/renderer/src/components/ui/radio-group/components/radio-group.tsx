import { cn } from "@/lib/utils"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import * as React from "react"

/** Renders the radio group component. */
export const RadioGroup = React.forwardRef<React.ElementRef<typeof RadioGroupPrimitive.Root>, React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  )
})

RadioGroup.displayName = RadioGroupPrimitive.Root.displayName
