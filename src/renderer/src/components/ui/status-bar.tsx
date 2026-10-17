import "@/components/ui/status-bar.css"
import { ReadOnlyDatePopover } from "@/components/read-only-date-popover"
import { cn } from "@/lib/utils"
import { CalendarDays, Clock3 } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"

/** Renders the status bar component. */
export function StatusBar({ left, children, right, after, className }: { left?: ReactNode; children?: ReactNode; right?: ReactNode; after?: ReactNode; className?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  /** Performs the pad operation. */
  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    <footer
      aria-label="底部状态栏"
      className={cn("vessel-status-bar", className)}
    >
      {left && <div className="vessel-status-left">{left}</div>}
      <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden">{children}</div>
      {right}
      <div className="vessel-status-clock tabular-nums">
        <ReadOnlyDatePopover
          date={now}
          label="查看日历"
          className="vessel-status-time"
        >
          <time
            dateTime={now.toISOString()}
            className="flex items-center gap-1"
          >
            <Clock3 className="size-3.5" />
            {now.getFullYear()}年{pad(now.getMonth() + 1)}月{pad(now.getDate())}日 {pad(now.getHours())}:{pad(now.getMinutes())}
          </time>
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            星期{"日一二三四五六"[now.getDay()]}
          </span>
        </ReadOnlyDatePopover>
      </div>
      {after}
    </footer>
  )
}
