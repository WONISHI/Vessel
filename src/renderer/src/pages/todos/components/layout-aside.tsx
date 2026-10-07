import type { ReactNode } from "react"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { useRouter } from "@vessel/react-router"
import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import ActivityBar from "@/layout/activity-bar"
import type { Todo } from "../../../../../shared/todos"
import { fromKey } from "../calendar"
import { cn } from "@/lib/utils"
export default function TodoAside({ todos, selected, onSelect, children }: { children: ReactNode; todos: Todo[]; selected: string; onSelect: (date: string) => void }) {
  const router = useRouter()
  const { width, setWidth, open } = useSidebar()
  const dates = [...new Set(todos.map((todo) => todo.date))].sort()
  return (
    <div className="flex h-full min-w-0 flex-1 bg-white">
      <ActivityBar
        activity="todos"
        onActivityChange={(activity) => {
          if (activity !== "todos") void router.push(activity === "tools" ? "/devtools" : activity === "files" ? "/editor" : `/${activity}`)
        }}
      />
      <ResizableSplit side="left" size={width} min={160} max={600} label="调整待办侧栏宽度" onResize={setWidth} pane={open ? <Sidebar collapsible="none" className="!w-full bg-stone-50">
        <header className="flex justify-between p-4 text-xs font-semibold text-stone-500">
          <span>待办日期</span>
          <span>{dates.length} 天</span>
        </header>
        <ScrollArea className="min-h-0 flex-1 px-3">
          {!dates.length && <p className="p-2 text-xs text-stone-400">暂无待办日期</p>}
          {dates.map((key, index) => {
            const date = fromKey(key)
            const items = todos.filter((todo) => todo.date === key)
            return (
              <div key={key}>
                {(index === 0 || dates[index - 1].slice(0, 7) !== key.slice(0, 7)) && (
                  <p className="px-2 pb-2 pt-5 text-xs font-semibold text-stone-400">
                    {date.getMonth() + 1}月 · {date.getFullYear()}
                  </p>
                )}
                <button
                  onClick={() => onSelect(key)}
                  aria-current={selected === key ? "date" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-stone-100", selected === key && "bg-emerald-50 hover:bg-emerald-50")}
                >
                  <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg border bg-white">
                    <strong className="text-lg leading-5">{date.getDate()}</strong>
                    <span className="text-[10px] text-stone-500">{"日一二三四五六"[date.getDay()]}</span>
                  </span>
                  <span className="flex-1">
                    <strong className="text-sm">
                      {date.getMonth() + 1}月{date.getDate()}日
                    </strong>
                    <span className="block text-xs text-stone-400">
                      周{"日一二三四五六"[date.getDay()]} · {items.length} 项
                    </span>
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 text-xs font-semibold text-green-700">{items.filter((todo) => !todo.completed).length}</span>
                </button>
              </div>
            )
          })}
        </ScrollArea>
      </Sidebar> : undefined}>{children}</ResizableSplit>
    </div>
  )
}
