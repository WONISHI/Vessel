import { groupBrowserTabs } from "@/pages/browser/tab-groups"
import { useTabGrouping } from "@/pages/browser/use-tab-grouping"
import { BrowserFavicon } from "@/components/browser-favicon"
import { TabSwitcher } from "@/components/tab-switcher"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu"
import { Copy, CopyX, AudioLines, LoaderCircle, Snowflake, Play, Package, PanelRightClose, Pin, Plus, RotateCw, X } from "lucide-react"
import type { BrowserPageModel } from "@/pages/browser/components/browser-page/hooks/use-browser-page"
import { useState } from "react"

/** 顶部标签栏 */
export function BrowserTabs({ b }: { b: BrowserPageModel }) {
  const { tabs, setActive, setInput, tab, add, close, closeTabs, addTabRightOf, reloadTab, togglePinTab, closeOtherTabs, closeRightTabs, freezeTab, dragTabId, setDragTabId, reorderTabs } = b

  const grouping = useTabGrouping()
  const [contextMenuOpen, setContextMenuOpen] = useState(false)
  const groups = groupBrowserTabs(tabs, tab.id, grouping)
  const lastGroupKey = groups.filter(group => group.members.length > 1).at(-1)?.key
  const contextActions = (item: { id: string; frozen?: boolean; url?: string }) => [
    { label: "复制标签页", icon: <Copy />, onSelect: () => addTabRightOf(item.id, true) },
    { label: "重新加载", icon: <RotateCw />, onSelect: () => reloadTab(item.id), disabled: !item.url },
    { label: item.frozen ? "解冻标签页" : "冻结标签页", icon: item.frozen ? <Play /> : <Snowflake />, onSelect: () => item.frozen ? setActive(item.id) : freezeTab(item.id), disabled: !item.url },
    { label: "关闭", icon: <X />, onSelect: () => close(item.id), separatorBefore: true },
    { label: "关闭其他标签页", icon: <CopyX />, onSelect: () => closeOtherTabs(item.id) }
  ]
  return (
        <div className="browser-tabs">
          {groups.map(({ key, kind, tab: item, members }, groupIndex) => {
            const grouped = members.length > 1
            const pinned = members.every((member) => member.pinned)
            const memberIds = [item.id, ...members.filter((member) => member.id !== item.id).map((member) => member.id)]
            const title = item.title
            const closeLabel = grouped ? `关闭整个分组：${title}（${members.length} 个标签页）` : "关闭标签页"
            const titleSide = key === lastGroupKey ? "left" : "right"
            const row = <ContextMenu key={item.id} onOpenChange={setContextMenuOpen}>
              <ContextMenuTrigger asChild>
                <div
                  data-browser-group={grouped ? key : undefined}
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
                  className={`browser-tab ${item.id === tab.id ? "selected" : ""} ${pinned ? "pinned" : ""} ${item.videoPlaying ? "playing" : ""}`}
                >
                  <button
                    onClick={() => {
                      setActive(item.id)
                      setInput(null)
                    }}
                    className={`browser-tab-select flex min-w-0 flex-1 items-center ${item.frozen ? "gap-3.5" : "gap-2"}`}
                    data-title={members.length > 1 ? undefined : item.frozen ? `${item.title} · 已冷冻，点击重新加载` : item.videoPlaying ? `${item.title} · 正在播放视频` : item.title}
                  >
                    <span className="relative flex size-4 shrink-0 items-center justify-center">
                      <span className={`flex ${item.id === tab.id && item.loading ? "invisible" : ""}`}>
                        <BrowserFavicon url={item.url} favicon={item.favicon} frozen={item.frozen} icon={grouped && kind === "local" ? <Package size={16} color="#016BFF" aria-label="本地资源分组" /> : undefined} />
                      </span>
                      {item.id === tab.id && item.loading
                        ? <LoaderCircle size={16} className="absolute inset-0 animate-spin" aria-label="正在加载" />
                        : null}
                    </span>
                    <span className="truncate leading-4">{title}</span>
                  </button>
                  {members.length > 1 && <span className="browser-tab-group-count" aria-label={`另有 ${members.length - 1} 个${kind === "local" ? "本地资源" : "同域名"}标签页`}>{members.length - 1}</span>}
                  {item.videoPlaying && <AudioLines size={16} className="browser-tab-audio" aria-label="正在播放视频" />}
                  <button
                    className={pinned ? "browser-tab-pin-close" : undefined}
                    data-title={closeLabel}
                    onClick={(event) => { event.stopPropagation(); event.preventDefault(); if (grouped) closeTabs(memberIds); else close(item.id) }} aria-label={pinned ? "已固定" : closeLabel}
                    disabled={pinned}
                    tabIndex={pinned ? -1 : undefined}
                  >
                    {pinned ? <Pin size={16} className="browser-tab-pin-icon" aria-hidden="true" /> : <X size={14} />}
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-44">
                <ContextMenuItem onSelect={() => addTabRightOf(item.id)}>
                  <Plus />
                  在右侧新增标签页
                </ContextMenuItem>
                {!grouped && <>
                  <ContextMenuItem onSelect={() => addTabRightOf(item.id, true)}>
                    <Copy />
                    复制标签页
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => reloadTab(item.id)}>
                    <RotateCw />
                    重新加载
                  </ContextMenuItem>
                  <ContextMenuItem disabled={!item.url} onSelect={() => item.frozen ? setActive(item.id) : freezeTab(item.id)}>
                    {item.frozen ? <Play /> : <Snowflake />}
                    {item.frozen ? "解冻标签页" : "冻结标签页"}
                  </ContextMenuItem>
                </>}
                <ContextMenuItem onSelect={() => togglePinTab(grouped ? memberIds : item.id)}>
                  <Pin />
                  {pinned ? "取消固定" : "固定"}
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => grouped ? closeTabs(memberIds) : close(item.id)}>
                  <X />
                  {grouped ? "关闭整个分组" : "关闭"}
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => closeOtherTabs(grouped ? memberIds : item.id)}><CopyX />关闭其他标签页</ContextMenuItem>
                <ContextMenuItem onSelect={() => grouped ? closeTabs(groups.slice(groupIndex + 1).flatMap((group) => group.members).filter((member) => !member.pinned).map((member) => member.id)) : closeRightTabs(item.id)}><PanelRightClose />关闭右侧标签页</ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
            return members.length > 1 ? <TabSwitcher key={key} contextActions={contextActions} disabled={contextMenuOpen} titleSide={titleSide} triggerClassName={`browser-tab-group ${members.some(member => member.id === tab.id) ? "browser-tab-group-selected" : ""}`} contentClassName="z-[510] vessel-browser-tabs-popup" tabs={members.map(member => ({ ...member, active: member.id === tab.id }))} onClose={close} onSelect={id => { setActive(id); setInput(null) }}>{row}</TabSwitcher> : row
          })}
          <div className="flex h-[var(--browser-tab-height)] w-[var(--browser-tab-height)] shrink-0 items-center justify-center">
            <TabSwitcher
              disabled={contextMenuOpen}
              contextActions={contextActions}
              contentClassName="z-[510] vessel-browser-tabs-popup"
              tabs={tabs.map((item) => ({ ...item, active: item.id === tab.id }))}
              onClose={close}
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
