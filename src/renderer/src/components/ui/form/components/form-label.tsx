import { useFormField } from "@/components/ui/form/components/form-shared"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the form label component. */
export const FormLabel = React.forwardRef<React.ElementRef<typeof Label>, React.ComponentPropsWithoutRef<typeof Label>>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField()
  return (
    <Label
      ref={ref}
      htmlFor={formItemId}
      className={cn(error && "text-destructive", className)}
      {...props}
    />
  )
})

FormLabel.displayName = "FormLabel"
