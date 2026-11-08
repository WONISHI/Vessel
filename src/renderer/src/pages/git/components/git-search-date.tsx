import { useState } from "react"
import { Calendar } from "lucide-react"
import { calendarDateKey } from "@vessel/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DateCalendar } from "@/components/read-only-date-popover/components/date-calendar"

export function GitSearchDate({ label, value, onChange, min, max }: { label: string; value: string; onChange: (value: string) => void; min?: string; max?: string }) {
  const [open, setOpen] = useState(false)
  const [year, month, day] = value.split("-").map(Number)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <button type="button" aria-label={label} className="flex h-8 w-36 items-center justify-between gap-2 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200">
        <span>{value.replaceAll("-", "/")}</span><Calendar className="size-3.5 text-stone-400" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-[260px] p-3 shadow-xl">
      {open && <DateCalendar key={value} date={new Date(year, month - 1, day)} min={min} max={max} onSelect={(date) => { onChange(calendarDateKey(date)); setOpen(false) }} />}
    </PopoverContent>
  </Popover>
}
