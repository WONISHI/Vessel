import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { isDirty, METHOD_COLOR, type RequestTab } from "@/pages/postman/lib/model"
import { Copy, Plus, X } from "lucide-react"
import { useEffect, useRef } from "react"

/** Postman-style request tab strip with unsaved markers and close / duplicate actions. */
export function RequestTabs({ tabs, activeId, onSelect, onClose, onCloseOthers, onDuplicate, onNew }: { tabs: RequestTab[]; activeId: string; onSelect: (id: string) => void; onClose: (id: string) => void; onCloseOthers: (id: string) => void; onDuplicate: (id: string) => void; onNew: () => void }) {
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    strip.current?.querySelector<HTMLElement>(`[data-tab-id="${activeId}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [activeId])
  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-stone-200 bg-stone-50/50">
      <div ref={strip} role="tablist" aria-label="请求标签页" className="api-tab-strip flex min-w-0 flex-1 items-stretch overflow-x-auto" onWheel={(event) => { if (strip.current && Math.abs(event.deltaY) > Math.abs(event.deltaX)) strip.current.scrollLeft += event.deltaY }}>
        {tabs.map((tab) => {
          const dirty = isDirty(tab)
          const active = tab.id === activeId
          return (
            <ContextMenu key={tab.id}>
              <ContextMenuTrigger asChild>
                <div
                  role="tab"
                  tabIndex={0}
                  data-tab-id={tab.id}
                  aria-selected={active}
                  onClick={() => onSelect(tab.id)}
                  onAuxClick={(event) => { if (event.button === 1) onClose(tab.id) }}
                  onKeyDown={(event) => { if (event.key === "Enter") onSelect(tab.id) }}
                  className={`group relative flex min-w-[120px] max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 border-r border-stone-200 pl-3 pr-1.5 text-xs ${active ? "bg-white text-stone-800 shadow-[inset_0_2px_0_#f59e0b]" : "text-stone-500 hover:bg-stone-100"}`}
                >
                  <span className={`shrink-0 text-[10px] font-bold ${METHOD_COLOR[tab.draft.method] ?? "text-blue-600"}`}>{tab.draft.method === "DELETE" ? "DEL" : tab.draft.method}</span>
                  <span className={`min-w-0 flex-1 truncate ${tab.draft.savedId ? "" : "italic"}`}>{tab.draft.name || "未命名"}</span>
                  <button
                    type="button"
                    aria-label={dirty ? "关闭（有未保存的修改）" : "关闭标签"}
                    onClick={(event) => { event.stopPropagation(); onClose(tab.id) }}
                    className="relative grid size-5 shrink-0 place-items-center rounded text-stone-400 hover:bg-stone-200 hover:text-stone-700"
                  >
                    {dirty && <span className="size-2 rounded-full bg-amber-500 group-hover:hidden" />}
                    <X className={`size-3 ${dirty ? "hidden group-hover:block" : active ? "" : "opacity-0 group-hover:opacity-100"}`} />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="api-history-menu w-36">
                <ContextMenuItem onSelect={() => onDuplicate(tab.id)}><Copy className="size-3.5" />复制标签</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => onClose(tab.id)}><X className="size-3.5" />关闭</ContextMenuItem>
                <ContextMenuItem disabled={tabs.length < 2} onSelect={() => onCloseOthers(tab.id)}>关闭其他标签</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
      <button type="button" aria-label="新建请求标签" data-title="新建请求" onClick={onNew} className="grid w-9 shrink-0 place-items-center border-l border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-amber-600">
        <Plus className="size-4" />
      </button>
    </div>
  )
}
