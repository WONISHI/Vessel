import * as React from "react"
import { FormProvider, useFormContext } from "react-hook-form"
export const Form = FormProvider
export const FormFieldContext = React.createContext<{ name: string } | null>(null)
export const FormItemContext = React.createContext<{ id: string } | null>(null)

/** Provides the form field hook. */
export function useFormField() {
  const field = React.useContext(FormFieldContext)
  const item = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  if (!field || !item) throw new Error("表单字段必须位于 FormField 和 FormItem 内")
  return { ...getFieldState(field.name, formState), name: field.name, formItemId: `${item.id}-form-item`, formDescriptionId: `${item.id}-form-description`, formMessageId: `${item.id}-form-message` }
}
