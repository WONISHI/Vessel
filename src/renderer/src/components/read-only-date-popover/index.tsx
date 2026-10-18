import { DateCalendar } from "@/components/read-only-date-popover/components/date-calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { ReactNode } from "react"

/** Shares the same read-only calendar popup between property dates and the status clock. */
export function ReadOnlyDatePopover({ date, children, label, className }: { date: Date; children: ReactNode; label: string; className?: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={className}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-[300] w-[260px] bg-white p-3 shadow-2xl"
      >
        <DateCalendar date={date} />
      </PopoverContent>
    </Popover>
  )
}
