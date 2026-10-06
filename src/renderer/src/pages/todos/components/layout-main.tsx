import { useState } from "react"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleCheck, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import type { Todo } from "../../../../../shared/todos"
import { dateKey, fromKey, lunarLabel, monthDays, festivalLabel } from "../calendar"
import "../todo-calendar.css"
import { cn } from "@/lib/utils"
import TodoTableSection from "./todo-table-section"
export default function TodoMain({
  todos,
  selected,
  month,
  onSelect,
  onMonth,
  onAdd,
  onComplete,
  onDelete,
  busy
}: {
  todos: Todo[]
  selected: string
  month: Date
  onSelect: (date: string) => void
  onMonth: (date: Date) => void
  onAdd: (title: string) => Promise<boolean>
  onComplete: (todo: Todo) => void
  onDelete: (id: number) => void
  busy: boolean
}) {
  const [title, setTitle] = useState("")
  const day = fromKey(selected),
    today = dateKey(new Date()),
    items = todos.filter((todo) => todo.date === selected)
  const days = monthDays(month)
  const move = (delta: number) => onMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1, 12))
  return (
    <main className="todo-calendar min-h-0 min-w-0 flex-1 overflow-auto bg-[#faf9f7] p-5">
      <Breadcrumb>
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>首页</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>待办日历</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="todo-calendar-layout mt-4">
        <section
          aria-label="月份日历"
          className="overflow-hidden rounded-2xl border border-stone-200 bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-4">
            <div>
              <h1 className="text-xl font-bold">
                {month.getFullYear()}年{month.getMonth() + 1}月{Math.min(day.getDate(), new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate())}日
              </h1>

            </div>
            <TooltipProvider>
              <div className="flex gap-1.5">
                {[
                  { label: "上一年", delta: -12, Icon: ChevronsLeft },
                  { label: "上个月", delta: -1, Icon: ChevronLeft },
                  { label: "今天", delta: 0, Icon: null },
                  { label: "下个月", delta: 1, Icon: ChevronRight },
                  { label: "下一年", delta: 12, Icon: ChevronsRight }
                ].map(({ label, delta, Icon }) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("h-8 px-2 hover:bg-green-700 active:bg-green-800 hover:!text-white active:!text-white", !Icon && "bg-green-700 !text-white hover:bg-green-800 hover:!text-white")}
                        aria-label={label}
                        onClick={() => (delta ? move(delta) : onSelect(today))}
                      >
                        {Icon ? <Icon className="size-4" /> : label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </header>
          <div className="p-3">
            <div className="grid grid-cols-[repeat(7,64px)] gap-1">
              {"一二三四五六日".split("").map((label, i) => (
                <div
                  key={label}
                  className={cn("py-2 text-center text-xs text-stone-400", i > 4 && "text-red-500")}
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[repeat(7,64px)] gap-1">
              {days.map((date) => {
                const key = dateKey(date),
                  count = todos.filter((todo) => todo.date === key).length
                return (
                  <button
                    key={key}
                    aria-label={`${key} ${lunarLabel(date, true)}`}
                    aria-pressed={key === selected}
                    onClick={() => onSelect(key)}
                    className={cn(
                      "relative flex h-16 w-16 shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-transparent bg-white p-1 text-center hover:bg-emerald-50",
                      date.getMonth() !== month.getMonth() && "opacity-40",
                      key === selected && "border-green-600 bg-emerald-50"
                    )}
                  >
                    <span className="relative inline-flex h-5 items-center justify-center text-sm font-medium">
                      {date.getDate()}
                      {key === today && (
                        <span
                          aria-label="今天"
                          className="absolute -bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-green-600"
                        />
                      )}
                    </span>
                    <span className={cn("mt-1.5 block max-w-full truncate text-[10px]", festivalLabel(date) ? "text-red-500" : "text-stone-400")}>{festivalLabel(date) || lunarLabel(date)}</span>
                    {count > 0 && (
                      <span
                        className="absolute bottom-0.5 right-1 text-[8px] text-green-700"
                        aria-label={`${count} 项待办`}
                      >
                        {"●".repeat(Math.min(count, 3))}
                        {count > 3 ? ` +${count - 3}` : ""}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
        <section
          aria-label="当天待办"
          className="space-y-4"
        >
          <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-700">
            {day.getMonth() + 1}月{day.getDate()}日 · 周{"日一二三四五六"[day.getDay()]} · 农历{lunarLabel(day, true)}
          </p>
          <div className="rounded-2xl border bg-white overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-stone-100 px-4 py-3 text-sm font-semibold">
              <CircleCheck className="size-4 text-green-700" />
              {day.getMonth() + 1}月{day.getDate()}日的待办
              <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">{items.length}</span>
            </h2>
            <form
              className="flex gap-2 px-4 pt-4"
              onSubmit={async (event) => {
                event.preventDefault()
                if (await onAdd(title)) setTitle("")
              }}
            >
              <Input
                className="!h-8 min-w-0 !text-xs"
                aria-label="待办内容"
                placeholder="输入待办，回车添加"
                maxLength={1000}
                value={title}
                disabled={busy}
                onChange={(event) => setTitle(event.target.value)}
              />
              <Button
                disabled={busy || !title.trim()}
                type="submit"
                className="h-8 px-3 text-xs bg-green-700 !text-white hover:bg-green-800"
              >
                添加
              </Button>
            </form>
            {!items.length && <p className="px-4 py-8 text-center text-xs text-stone-400">这一天还没有待办</p>}
            <ul className="max-h-96 overflow-y-auto px-4 py-3 space-y-2">
              {items.map((todo) => (
                <li
                  key={todo.id}
                  className="flex items-start gap-2 border-b py-2"
                >
                  <input
                    type="checkbox"
                    aria-label={`完成：${todo.title}`}
                    checked={todo.completed}
                    disabled={busy}
                    onChange={() => onComplete(todo)}
                    className="mt-1 accent-green-700"
                  />
                  <span className={cn("min-w-0 flex-1 break-words text-xs", todo.completed && "text-stone-400 line-through")}>{todo.title}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-stone-400 hover:bg-green-700 active:bg-green-800 hover:!text-white active:!text-white"
                    disabled={busy}
                    aria-label={`删除：${todo.title}`}
                    onClick={() => onDelete(todo.id)}
                  >
                    <Trash2 className="!size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <TodoTableSection />
    </main>
  )
}
