import { useFormField } from "@/components/ui/form/components/form-shared"
import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the form description component. */
export const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField()
  return (
    <p
      ref={ref}
      id={formDescriptionId}
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
})

FormDescription.displayName = "FormDescription"
