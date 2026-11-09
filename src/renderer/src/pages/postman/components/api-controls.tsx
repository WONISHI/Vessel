import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** shadcn Checkbox in the API page's amber accent. */
export function ApiCheckbox({ className, ...props }: ComponentProps<typeof Checkbox>) {
  return <Checkbox {...props} className={cn("api-checkbox size-3.5 rounded-[4px] border-stone-300 data-[state=checked]:border-amber-500 data-[state=checked]:bg-amber-500 data-[state=checked]:text-white data-[state=indeterminate]:border-amber-500 data-[state=indeterminate]:bg-amber-500 data-[state=indeterminate]:text-white dark:border-stone-600 [&_svg]:size-3", className)} />
}

/** shadcn RadioGroupItem in the API page's amber accent. */
export function ApiRadio({ className, ...props }: ComponentProps<typeof RadioGroupItem>) {
  return <RadioGroupItem {...props} className={cn("api-radio size-3.5 border-stone-300 text-amber-500 data-[state=checked]:border-amber-500 dark:border-stone-600 [&_svg]:size-2", className)} />
}
