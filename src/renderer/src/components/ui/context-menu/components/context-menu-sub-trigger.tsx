import { cn } from "@/lib/utils"
import * as Primitive from "@radix-ui/react-context-menu"
import * as React from "react"
import { ChevronRight } from "lucide-react"

/** Renders the context menu sub trigger component. */
export const ContextMenuSubTrigger = React.forwardRef<React.ElementRef<typeof Primitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof Primitive.SubTrigger>>(({ className, children, ...props }, ref) => (
  <Primitive.SubTrigger
    ref={ref}
    className={cn(
      "group/context-submenu flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none data-[highlighted]:bg-green-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white data-[state=open]:bg-green-600 data-[state=open]:!text-white data-[state=open]:[&_*]:!text-white data-[state=open]:[&_svg]:!text-white data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-3.5",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight aria-hidden className="ml-auto shrink-0 transition-transform duration-150 ease-out group-data-[state=open]/context-submenu:rotate-90 motion-reduce:transition-none" />
  </Primitive.SubTrigger>
))

ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger"
