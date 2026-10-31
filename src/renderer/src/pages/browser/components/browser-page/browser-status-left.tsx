import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ChevronRight, ChevronUp, Link2, Search } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 底部状态栏左侧信息 */
export function BrowserStatusLeft({ b }: { b: BrowserPageModel }) {
  const { toolbarCollapsed, setToolbarCollapsed, setFindOpen, findInput, setFindPosition, tab } = b

  return (
            <>
              <button
                aria-label={toolbarCollapsed ? "展开浏览器工具栏" : "折叠浏览器工具栏"}
                aria-expanded={!toolbarCollapsed}
                onClick={() => setToolbarCollapsed((value) => !value)}
                className="shrink-0 rounded p-1 !bg-transparent text-stone-500 hover:!bg-stone-200 hover:text-stone-800"
              >
                {toolbarCollapsed ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
              </button>
              <button
                className="flex shrink-0 items-center gap-1 rounded px-2 py-1 hover:bg-stone-200"
                onClick={() => {
                  setFindPosition(null)
                  setFindOpen(true)
                  requestAnimationFrame(() => findInput.current?.focus())
                }}
              >
                <Search size={13} />
                搜索
              </button>
              <span className="mx-1 h-4 border-l border-stone-300" />
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex min-w-0 max-w-[360px] cursor-default items-center gap-1.5 px-1 font-['Plus_Jakarta_Sans',sans-serif] text-[11.5px] text-stone-500">
                      <Link2
                        size={13}
                        className="shrink-0"
                      />
                      <span className="truncate">{tab.loading ? "正在加载…" : tab.url || "就绪"}</span>
                    </span>
                  </TooltipTrigger>
                  {tab.url ? (
                    <TooltipContent
                      side="top"
                      sideOffset={6}
                      className="max-w-[480px] break-all font-['Plus_Jakarta_Sans',sans-serif] text-xs"
                    >
                      {tab.url}
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>
            </>
  )
}
