import { cn } from "@/lib/utils"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, Circle } from "lucide-react"
import * as React from "react"

/** Renders the dropdown menu radio item component. */
export const DropdownMenuRadioItem = React.forwardRef<React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>, React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & { checkOnRight?: boolean }>(({ className, children, checkOnRight, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn("relative flex cursor-default select-none items-center rounded-sm py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50", checkOnRight ? "pl-2 pr-8" : "pl-8 pr-2", className)}
    {...props}
  >
    <span className={cn("absolute flex h-3.5 w-3.5 items-center justify-center", checkOnRight ? "right-2" : "left-2")}>
      <DropdownMenuPrimitive.ItemIndicator>
        {checkOnRight ? <Check className="size-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))

DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName
