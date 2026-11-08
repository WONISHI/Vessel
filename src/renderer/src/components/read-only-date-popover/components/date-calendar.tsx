import { cn } from "@/lib/utils"
import { calendarDateKey, calendarMonthDays } from "@vessel/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

/** Browses calendar dates in local state without exposing any persistence callback. */
export function DateCalendar({ date, onSelect, min, max }: { date: Date; onSelect?: (date: Date) => void; min?: string; max?: string }) {
  const [selected, setSelected] = useState(date)
  const [month, setMonth] = useState(date)

  /** Moves the preview selection and displayed month without modifying the source date. */
  const selectDate = (value: Date) => {
    const key = calendarDateKey(value)
    if ((min && key < min) || (max && key > max)) return
    onSelect?.(value)
    setSelected(value)
    setMonth(value)
  }

  return (
    <div className="vessel-date-calendar" aria-label={onSelect ? "选择日期" : "只读日历"}>
      <div className="mb-2 flex items-center justify-between border-b border-stone-100 pb-2">
        <button
          aria-label="上个月"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="rounded p-1 text-stone-500 hover:bg-stone-100"
        >
          <ChevronLeft className="size-4" />
        </button>
        {onSelect ? <div className="flex items-center gap-1 text-xs font-bold">
          <select aria-label="年份" value={month.getFullYear()} onChange={(event) => setMonth(new Date(Number(event.target.value), month.getMonth(), 1))} className="bg-transparent">
            {Array.from({ length: 181 }, (_, index) => 1900 + index).map((year) => <option key={year} value={year}>{year}年</option>)}
          </select>
          <select aria-label="月份" value={month.getMonth()} onChange={(event) => setMonth(new Date(month.getFullYear(), Number(event.target.value), 1))} className="bg-transparent">
            {Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{index + 1}月</option>)}
          </select>
        </div> : <span className="text-xs font-bold">{month.getFullYear()}年 {month.getMonth() + 1}月</span>}
        <button
          aria-label="下个月"
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="rounded p-1 text-stone-500 hover:bg-stone-100"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] text-stone-400">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mb-2 grid grid-cols-7 gap-1">
        {calendarMonthDays(month).map((day) => (
          <button
            key={calendarDateKey(day)}
            aria-label={calendarDateKey(day)}
            disabled={(!!min && calendarDateKey(day) < min) || (!!max && calendarDateKey(day) > max)}
            aria-pressed={calendarDateKey(day) === calendarDateKey(selected)}
            onClick={() => selectDate(day)}
            className={cn(
              "vessel-date-day flex size-7 items-center justify-center rounded-lg text-xs disabled:opacity-30 disabled:pointer-events-none hover:bg-green-50 hover:text-green-700",
              day.getMonth() !== month.getMonth() && "text-stone-300",
              calendarDateKey(day) === calendarDateKey(selected) && "bg-green-600 text-white hover:bg-green-700 hover:text-white"
            )}
          >
            {day.getDate()}
          </button>
        ))}
      </div>
      <div className="flex justify-between border-t border-stone-100 pt-2">
        {[
          { label: "今天", offset: 0 },
          { label: "明天", offset: 1 },
          { label: "下周", offset: 7 }
        ].map((item) => (
          <button
            key={item.label}
            className="vessel-date-shortcut rounded bg-stone-100 px-2.5 py-1 text-[11px] hover:bg-green-50 hover:text-green-700"
            onClick={() => {
              const day = new Date()
              day.setDate(day.getDate() + item.offset)
              selectDate(day)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {!onSelect && <p className="mt-2 text-[10px] text-stone-400">仅供查看，不修改原始日期</p>}
    </div>
  )
}
