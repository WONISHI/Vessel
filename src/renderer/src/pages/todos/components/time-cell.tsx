import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, MoreVertical } from "lucide-react"
import { useState } from "react"
import { dateKey, monthDays } from "../calendar"

import { formatTodoDate, parseTodoDate } from "./todo-table-model"

export function TimeCell({ time, onUpdateTime }: { time?: string; onUpdateTime: (t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseTodoDate(time))

  const days = monthDays(viewDate)
  const todayKey = dateKey(new Date())

  const handleSelectDay = (d: Date) => {
    const formatted = formatTodoDate(d)
    onUpdateTime(formatted)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-1.5 cursor-pointer py-1 px-1.5 rounded border border-transparent hover:border-stone-200 hover:bg-stone-100/70 transition-colors">
          <CalendarIcon className="size-3.5 shrink-0 text-stone-400" />
          <span className="text-stone-700 font-mono text-xs font-normal whitespace-nowrap">{time ? formatTodoDate(parseTodoDate(time)) : "选择日期"}</span>
          <MoreVertical className="size-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity ml-auto" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[260px] p-3 bg-white shadow-2xl z-[200]"
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-2">
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            className="p-1 rounded hover:bg-stone-100 text-stone-500"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-xs font-bold text-stone-800">
            {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
          </span>
          <button
            onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            className="p-1 rounded hover:bg-stone-100 text-stone-500"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-stone-400 mb-1">
          {["一", "二", "三", "四", "五", "六", "日"].map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 text-xs mb-2.5">
          {days.map((date) => {
            const isCurrentMonth = date.getMonth() === viewDate.getMonth()
            const isToday = dateKey(date) === todayKey
            const isSelected = !!time && dateKey(date) === dateKey(parseTodoDate(time))
            return (
              <button
                key={dateKey(date)}
                aria-label={formatTodoDate(date)}
                aria-pressed={isSelected}
                onClick={() => handleSelectDay(date)}
                className={cn(
                  "size-7 flex flex-col items-center justify-center rounded-lg text-xs font-medium transition-colors",
                  !isCurrentMonth && "text-stone-300",
                  isCurrentMonth && "text-stone-700 hover:bg-green-50 hover:text-green-700",
                  isToday && !isSelected && "ring-1 ring-green-200",
                  isSelected && "bg-green-600 text-white font-bold hover:bg-green-700 hover:text-white"
                )}
              >
                {date.getDate()}
              </button>
            )
          })}
        </div>

        <div className="flex justify-between border-t border-stone-100 pt-2 text-[11px]">
          <button
            onClick={() => handleSelectDay(new Date())}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            今天
          </button>
          <button
            onClick={() => {
              const tm = new Date()
              tm.setDate(tm.getDate() + 1)
              handleSelectDay(tm)
            }}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            明天
          </button>
          <button
            onClick={() => {
              const nw = new Date()
              nw.setDate(nw.getDate() + 7)
              handleSelectDay(nw)
            }}
            className="px-2.5 py-1 rounded bg-stone-100 hover:bg-green-50 hover:text-green-700 text-stone-600 font-medium transition-colors"
          >
            下周
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
