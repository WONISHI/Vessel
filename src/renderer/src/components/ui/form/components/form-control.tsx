import { useFormField } from "@/components/ui/form/components/form-shared"
import { Slot } from "@radix-ui/react-slot"
import * as React from "react"

/** Renders the form control component. */
export const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>((props, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField()
  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={!!error}
      {...props}
    />
  )
})

FormControl.displayName = "FormControl"
