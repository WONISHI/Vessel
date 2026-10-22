import ActivityBar from "@/components/layout/activity-bar/index"
import { ResizableSplit } from "@/components/ui/resizable-split"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { fromKey } from "@/pages/todos/calendar"
import { useRouter } from "@vessel/react-router"
import type { Todo } from "@vessel/type"
import type { ReactNode } from "react"

/** Renders the todo aside component. */
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
      <ResizableSplit
        side="left"
        size={width}
        min={160}
        max={600}
        label="调整待办侧栏宽度"
        onResize={setWidth}
        pane={
          open ? (
            <Sidebar
              collapsible="none"
              className="todo-date-sidebar !w-full bg-stone-50"
            >
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
                        <p className="px-2 pb-2 pt-3 text-[11px] font-medium tracking-wide text-stone-400">
                          {date.getMonth() + 1}月 · {date.getFullYear()}
                        </p>
                      )}
                      <button
                        onClick={() => onSelect(key)}
                        aria-current={selected === key ? "date" : undefined}
                        className={cn("todo-date-list-item relative mb-1 flex w-full items-center gap-2.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-stone-100", selected === key && "bg-emerald-50 hover:bg-emerald-50")}
                      >
                        <span className="todo-date-list-icon flex h-10 w-9 shrink-0 flex-col items-center justify-center rounded-md border bg-white">
                          <strong className="text-[19px] font-semibold leading-5 tabular-nums">{date.getDate()}</strong>
                          <span className="text-[10px] text-stone-500">{"日一二三四五六"[date.getDay()]}</span>
                        </span>
                        <span className="flex-1">
                          <strong className="text-[13px] font-semibold leading-5">
                            {date.getMonth() + 1}月{date.getDate()}日
                          </strong>
                          <span className="mt-0.5 block text-[11px] text-stone-400">
                            {items.length} 项待办
                          </span>
                        </span>
                        <span aria-label={`${items.filter((todo) => !todo.completed).length} 项未完成`} className="todo-date-list-count flex h-5 min-w-5 items-center justify-center rounded-md bg-emerald-50 px-1.5 text-[10px] font-medium tabular-nums text-green-700">{items.filter((todo) => !todo.completed).length}</span>
                      </button>
                    </div>
                  )
                })}
              </ScrollArea>
            </Sidebar>
          ) : undefined
        }
      >
        {children}
      </ResizableSplit>
    </div>
  )
}
