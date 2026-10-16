import { cn } from "@/lib/utils"
import type { ComponentProps } from "react"

/** Renders the kbd component. */
export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded border border-stone-200 bg-stone-100 px-1.5 font-mono text-[11px] font-medium text-stone-600 shadow-[0_1px_0_#e7e5e4]", className)}
      {...props}
    />
  )
}
