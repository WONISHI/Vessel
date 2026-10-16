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
      className={cn("flex h-8 shrink-0 items-center gap-1 border-t border-stone-200 bg-stone-100 px-2 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300", className)}
    >
      {left && <div className="flex min-w-0 items-center gap-1">{left}</div>}
      <div className="flex min-w-0 flex-1 items-center justify-end overflow-hidden">{children}</div>
      {right}
      <div className="flex shrink-0 items-center border-l border-stone-300 pl-1 tabular-nums">
        <div className="flex h-6 items-center gap-2.5 rounded px-1.5 transition-colors cursor-default hover:bg-stone-200 hover:shadow-sm dark:hover:bg-stone-800">
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
        </div>
      </div>
      {after}
    </footer>
  )
}
