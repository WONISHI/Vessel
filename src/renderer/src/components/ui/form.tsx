import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { Controller, FormProvider, useFormContext, type ControllerProps, type FieldPath, type FieldValues } from "react-hook-form"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"

const Form = FormProvider
const FormFieldContext = React.createContext<{ name: string } | null>(null)
const FormItemContext = React.createContext<{ id: string } | null>(null)

function FormField<TValues extends FieldValues, TName extends FieldPath<TValues>>({ ...props }: ControllerProps<TValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  )
}
function useFormField() {
  const field = React.useContext(FormFieldContext)
  const item = React.useContext(FormItemContext)
  const { getFieldState, formState } = useFormContext()
  if (!field || !item) throw new Error("表单字段必须位于 FormField 和 FormItem 内")
  return { ...getFieldState(field.name, formState), name: field.name, formItemId: `${item.id}-form-item`, formDescriptionId: `${item.id}-form-description`, formMessageId: `${item.id}-form-message` }
}
const FormItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div
        ref={ref}
        className={cn("space-y-2", className)}
        {...props}
      />
    </FormItemContext.Provider>
  )
})
FormItem.displayName = "FormItem"
const FormLabel = React.forwardRef<React.ElementRef<typeof Label>, React.ComponentPropsWithoutRef<typeof Label>>(({ className, ...props }, ref) => {
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
const FormControl = React.forwardRef<React.ElementRef<typeof Slot>, React.ComponentPropsWithoutRef<typeof Slot>>((props, ref) => {
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
const FormDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => {
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
const FormMessage = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, children, ...props }, ref) => {
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
export { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage }
