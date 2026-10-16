import { useFormField } from "@/components/ui/form/components/form-shared"
import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the form message component. */
export const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField()
  const body = error ? String(error.message ?? "") : children
  return body ? (
    <p
      ref={ref}
      id={formMessageId}
      role="alert"
      className={cn("text-sm font-medium text-destructive", className)}
      {...props}
    >
      {body}
    </p>
  ) : null
})

FormMessage.displayName = "FormMessage"
