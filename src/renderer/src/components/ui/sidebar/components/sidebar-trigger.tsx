import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar/components/sidebar-shared"
import { cn } from "@/lib/utils"
import { PanelLeft } from "lucide-react"
import * as React from "react"

/** Renders the sidebar trigger component. */
export const SidebarTrigger = React.forwardRef<React.ElementRef<typeof Button>, React.ComponentProps<typeof Button>>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7 !bg-transparent text-stone-700 hover:!bg-stone-100 hover:text-stone-900 active:!bg-stone-200", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})

SidebarTrigger.displayName = "SidebarTrigger"
