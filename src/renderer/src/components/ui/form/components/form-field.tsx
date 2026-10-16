import { FormFieldContext } from "@/components/ui/form/components/form-shared"
import { Controller, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form"

/** Renders the form field component. */
export function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({ ...props }: ControllerProps<TValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}
