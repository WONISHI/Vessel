import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the command shortcut component. */
export const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)}
      {...props}
    />
  )
}

CommandShortcut.displayName = "CommandShortcut"
