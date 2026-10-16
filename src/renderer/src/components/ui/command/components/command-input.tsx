import { cn } from "@/lib/utils"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import * as React from "react"

/** Renders the command input component. */
export const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(({ className, ...props }, ref) => (
  <div
    className="flex items-center border-b px-3"
    data-command-input-wrapper=""
  >
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn("flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50", className)}
      {...props}
    />
  </div>
))

CommandInput.displayName = CommandPrimitive.Input.displayName
