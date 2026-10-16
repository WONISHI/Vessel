import { cn } from "@/lib/utils"
import * as React from "react"

/** Renders the alert dialog header component. */
export const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col space-y-2 text-center sm:text-left", className)}
    {...props}
  />
)

AlertDialogHeader.displayName = "AlertDialogHeader"
