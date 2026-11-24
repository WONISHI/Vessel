import "@/components/ui/status-bar.css"
import { StatusClock } from "@/components/ui/status-clock"
import { cn } from "@/lib/utils"
import { type ReactNode } from "react"
import { useStatusBarVisible } from "@/features/status-bar/visibility"

/** Renders the status bar component. */
export function StatusBar({ left, children, right, after, className, visible: visibleOverride }: { visible?: boolean; left?: ReactNode; children?: ReactNode; right?: ReactNode; after?: ReactNode; className?: string }) {
  const visible = useStatusBarVisible()
  if (!(visibleOverride ?? visible)) return null
  return (
    <footer
      aria-label="底部状态栏"
      className={cn("vessel-status-bar", className)}
    >
      {left && <div className="vessel-status-left">{left}</div>}
      <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden">{children}</div>
      {right}
      <StatusClock />
      {after}
    </footer>
  )
}
