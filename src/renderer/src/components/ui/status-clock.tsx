import { ReadOnlyDatePopover } from "@/components/read-only-date-popover"
import { CalendarDays, Clock3 } from "lucide-react"
import { useEffect, useState } from "react"

/** The same minute-aligned clock is used in the footer and title bar. */
export function StatusClock({ className = "vessel-status-clock" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    }
    timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50)
    return () => clearTimeout(timer)
  }, [])
  const pad = (value: number) => String(value).padStart(2, "0")
  return (
      <div className={className + " tabular-nums"}>
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
  )
}
