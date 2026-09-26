import type { ComponentPropsWithoutRef } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

/** 文档正文排版容器；asChild 可将排版样式附加到编辑器宿主，不改变其 DOM 结构。 */
export function Typography({ asChild = false, className, ...props }: ComponentPropsWithoutRef<"article"> & { asChild?: boolean }) {
  const Component = asChild ? Slot : "article"
  return (
    <Component
      className={cn("vessel-typography font-sans text-sm leading-relaxed text-stone-700", className)}
      {...props}
    />
  )
}
