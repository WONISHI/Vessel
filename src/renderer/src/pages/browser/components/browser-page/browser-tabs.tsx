import { BrowserFavicon } from "@/components/browser-favicon"
import { TabSwitcher } from "@/components/tab-switcher"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { AudioLines, LoaderCircle, Pin, Plus, RotateCw, X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"

/** 顶部标签栏 */
export function BrowserTabs({ b }: { b: BrowserPageModel }) {
  const { tabs, setActive, setInput, tab, add, close, addTabRightOf, reloadTab, togglePinTab, closeOtherTabs, closeRightTabs, dragTabId, setDragTabId, reorderTabs } = b

  return (
        <div className="browser-tabs">
          {tabs.map((item) => (
            <ContextMenu key={item.id}>
              <ContextMenuTrigger asChild>
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item.id)
                    setDragTabId(item.id)
                  }}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const sourceId = e.dataTransfer.getData("text/plain") || dragTabId
                    if (sourceId && sourceId !== item.id) reorderTabs(sourceId, item.id)
                  }}
                  onDragEnd={() => setDragTabId(null)}
                  className={`browser-tab ${item.id === tab.id ? "selected" : ""} ${item.pinned ? "pinned" : ""}`}
                >
                  <button
                    onClick={() => {
                      setActive(item.id)
                      setInput(null)
                    }}
                    className="browser-tab-select flex min-w-0 flex-1 items-center gap-2"
                    data-title={item.videoPlaying ? `${item.title} · 正在播放视频` : item.title}
                  >
                    {item.loading
                      ? <LoaderCircle size={16} className="shrink-0 animate-spin" aria-label="正在加载" />
                      : item.videoPlaying
                      ? <AudioLines size={16} className="shrink-0 text-green-600" aria-label="正在播放视频" />
                      : <BrowserFavicon key={`${item.url}:${item.favicon || ""}`} url={item.url} favicon={item.favicon} />}
                    {!item.pinned && <span className="truncate">{item.title}</span>}
                  </button>
                  {!item.pinned && (
                    <button
                      data-title="关闭标签页"
                      onClick={() => close(item.id)} aria-label="关闭标签页"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem onSelect={() => addTabRightOf(item.id)}>
                  <Plus />
                  在右侧新增标签页
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => reloadTab(item.id)}>
                  <RotateCw />
                  重新加载
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => togglePinTab(item.id)}>
                  <Pin />
                  {item.pinned ? "取消固定" : "固定"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => close(item.id)}>
                  <X />
                  关闭
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => closeOtherTabs(item.id)}>关闭其他标签页</ContextMenuItem>
                <ContextMenuItem onSelect={() => closeRightTabs(item.id)}>关闭右侧标签页</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
          <div className="flex h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] shrink-0 items-center justify-center">
            <TabSwitcher
              contentClassName="z-[310]"
              tabs={tabs.map((item) => ({ ...item, active: item.id === tab.id }))}
              onSelect={(id) => {
                setActive(id)
                setInput(null)
              }}
            >
              <Button
                variant="ghost"
                size="icon"
                data-title="新标签页"
                className="browser-new-tab h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] rounded-t-lg rounded-b-none text-stone-500 hover:bg-stone-200"
                onClick={add} aria-label="新标签页"
              >
                <Plus className="size-4" />
              </Button>
            </TabSwitcher>
          </div>
        </div>
  )
}
