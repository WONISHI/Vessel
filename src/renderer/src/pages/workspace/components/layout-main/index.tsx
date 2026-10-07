import Canvas from "./canvas"
import WorkspaceHome from "./workspace-home"
import { TabSwitcher } from "@/components/tab-switcher"
import { List } from "lucide-react"
import Clock from "react-live-clock"
import { StatusTarget } from "./status-context"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable-panels"
import { TerminalPanel } from "./terminal-panel"
import { FileSearch } from "./file-search"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useEffect, useRef, useState } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"
import { File, Home, X, MoreHorizontal, ChevronLeft, ChevronRight, SquareChevronRight, SquareChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouterView } from "@vessel/react-router/components"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

/** 主区只负责标签导航和当前子路由出口。 */
export default function LayoutMain({ resources = false }: { resources?: boolean }) {
  const { workspace, openFiles, activeFilePath, openWorkspaceFile, closeWorkspaceFile, closeWorkspaceFiles, navigateToWorkspaceHome } = useWorkspace()
  const [weekday, setWeekday] = useState(() => new Date().getDay())
  const [statusTarget, setStatusTarget] = useState<HTMLDivElement | null>(null)
  const [terminal, setTerminal] = useState<{ file?: string } | null>(null)
  const location = useLocation()
  const home = resources ? !activeFilePath : ["/editor", "/resources"].includes(location.pathname)
  const [edges, setEdges] = useState({ left: false, right: false })
  const tabList = useRef<HTMLDivElement>(null)
  const contentHost = useRef<HTMLDivElement>(null)
  const activeIndex = home ? -1 : openFiles.findIndex((file) => file.path === activeFilePath)
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!contentHost.current?.getClientRects().length) return
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.isComposing) return
      const key = event.key.toLowerCase()
      if (key !== "l" && key !== "r") return
      event.preventDefault()
      event.stopPropagation()
      const target = activeIndex + (key === "l" ? -1 : 1)
      if (activeIndex >= 0 && target >= 0 && target < openFiles.length) openWorkspaceFile(openFiles[target])
    }
    window.addEventListener("keydown", handleShortcut, true)
    return () => window.removeEventListener("keydown", handleShortcut, true)
  }, [activeIndex, openFiles, openWorkspaceFile])
  useEffect(() => {
    const list = tabList.current
    if (!list) return
    const updateEdges = () => setEdges({ left: list.scrollLeft > 1, right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1 })
    list.addEventListener("scroll", updateEdges)
    const reveal = () => {
      updateEdges()
      const tab = list.querySelector<HTMLElement>('[data-active="true"]')
      if (!tab) return
      const bounds = list.getBoundingClientRect()
      const rect = tab.getBoundingClientRect()
      if (rect.left < bounds.left) list.scrollBy({ left: rect.left - bounds.left - 4, behavior: "smooth" })
      else if (rect.right > bounds.right) list.scrollBy({ left: rect.right - bounds.right + 4, behavior: "smooth" })
    }
    const frame = requestAnimationFrame(reveal)
    const observer = new ResizeObserver(reveal)
    observer.observe(list)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      list.removeEventListener("scroll", updateEdges)
    }
  }, [activeFilePath, home, openFiles.length])
  return (
    <StatusTarget.Provider value={statusTarget}><main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <nav
        aria-label="已打开的标签"
        className="flex h-10 shrink-0 items-center gap-1 border-b border-[#f0efed] bg-white px-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label="上一个标签页"
                className="size-7 text-stone-500 hover:bg-emerald-700 hover:text-white"
                disabled={activeIndex <= 0}
                onClick={() => openWorkspaceFile(openFiles[activeIndex - 1])}
              >
                <ChevronLeft className="!size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            上一个标签页 <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl+L</kbd>
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          aria-current={home ? "page" : undefined}
          onClick={navigateToWorkspaceHome}
          className={cn("h-[30px] shrink-0 rounded-lg border border-stone-200/70 px-3 text-xs hover:bg-[#f0efed] hover:text-stone-700", home ? "bg-emerald-700 font-semibold text-white" : "bg-white text-stone-500")}
        >
          <Home className="!size-3.5" />
          工作台
        </Button>
        <div className="relative min-w-0 flex-1">
          <div
            ref={tabList}
            className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {openFiles.map((file) => {
              const active = !home && activeFilePath === file.path
              return (
                <div
                  key={file.path}
                  data-active={active}
                  className={cn("group flex h-[30px] shrink-0 items-center rounded-lg border border-stone-200/70 pr-1 hover:bg-[#f0efed]", active ? "bg-emerald-50 text-green-700" : "bg-white text-stone-500")}
                >
                  <Button
                    variant="ghost"
                    title={file.path}
                    aria-current={active ? "page" : undefined}
                    onClick={() => openWorkspaceFile(file)}
                    className="h-[30px] gap-1.5 whitespace-nowrap px-2 text-xs text-inherit hover:bg-transparent hover:text-inherit"
                  >
                    <File className="!size-3.5" />
                    <span className="truncate">{file.name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`关闭 ${file.name}`}
                    onClick={() => closeWorkspaceFile(file.path)}
                    className="size-5 rounded text-inherit hover:bg-stone-200 hover:text-inherit opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X className="!size-3" />
                  </Button>
                </div>
              )
            })}
          </div>
          {edges.left && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 z-10 w-2 bg-gradient-to-r from-stone-200/20 to-transparent"
            />
          )}
          {edges.right && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 z-10 w-2 bg-gradient-to-l from-stone-200/20 to-transparent"
            />
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label="下一个标签页"
                className="size-7 text-stone-500 hover:bg-emerald-700 hover:text-white"
                disabled={activeIndex < 0 || activeIndex >= openFiles.length - 1}
                onClick={() => openWorkspaceFile(openFiles[activeIndex + 1])}
              >
                <ChevronRight className="!size-4" />
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            下一个标签页 <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl+R</kbd>
          </TooltipContent>
        </Tooltip>
        {!home && activeFilePath && (
          <FileSearch
            key={activeFilePath}
            path={activeFilePath}
            contentHost={contentHost}
          />
        )}
        <TabSwitcher tabs={openFiles.map(file => ({ id: file.path, title: file.name, active: file.path === activeFilePath }))} onSelect={id => { const file = openFiles.find(file => file.path === id); if (file) openWorkspaceFile(file) }}><Button variant="ghost" size="icon" aria-label="已打开的标签页" className="size-7"><List className="size-4" /></Button></TabSwitcher>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="标签页操作"
                  className="size-7 shrink-0 text-stone-500 hover:bg-emerald-700 hover:text-white"
                >
                  <MoreHorizontal className="!size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>标签页操作</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-44 rounded-lg !bg-white p-1 [&_[role=menuitem]]:px-2 [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]]:font-normal [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700 [&_[role=menuitem][data-state=open]]:!bg-[#f0efed]">
            <DropdownMenuSub><DropdownMenuSubTrigger>标签页（{openFiles.length}）</DropdownMenuSubTrigger><DropdownMenuSubContent className="max-h-72 max-w-72 overflow-auto !bg-white [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700">{openFiles.map(file => <DropdownMenuItem key={file.path} className={file.path === activeFilePath ? "bg-emerald-50 text-green-700" : ""} onSelect={() => openWorkspaceFile(file)}><span className="truncate">{file.name}</span></DropdownMenuItem>)}</DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!activeFilePath}
              onSelect={() => closeWorkspaceFile(activeFilePath)}
            >
              关闭当前标签页
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!activeFilePath || openFiles.length < 2}
              onSelect={() => closeWorkspaceFiles(openFiles.filter((file) => file.path !== activeFilePath).map((file) => file.path))}
            >
              关闭其他标签页
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!activeFilePath || openFiles.findIndex((file) => file.path === activeFilePath) === openFiles.length - 1}
              onSelect={() => closeWorkspaceFiles(openFiles.slice(openFiles.findIndex((file) => file.path === activeFilePath) + 1).map((file) => file.path))}
            >
              关闭右侧标签页
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!openFiles.length}
              onSelect={() => closeWorkspaceFiles(openFiles.map((file) => file.path))}
            >
              关闭所有标签页
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel id="editor" defaultSize="70%" minSize="20%" className="flex min-h-0 flex-col">
          <div ref={contentHost} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{resources ? (home ? <WorkspaceHome /> : <Canvas />) : <RouterView />}</div>
          <footer className="shrink-0 border-t bg-stone-50 px-3 py-1 text-xs text-stone-500">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" aria-pressed={!!terminal} className={`h-6 gap-1 px-2 text-xs hover:bg-emerald-700 hover:!text-white active:!text-white ${terminal ? "bg-emerald-700 !text-white" : "text-stone-500"}`} aria-label={terminal ? "关闭控制台" : "打开控制台"} onClick={() => setTerminal(current => current ? null : { file: home ? undefined : activeFilePath || undefined })}>
                {terminal ? <SquareChevronDown className="!size-4" /> : <SquareChevronRight className="!size-4" />}控制台
              </Button>
              <div ref={setStatusTarget} className="min-w-0 flex-1" />
              <Clock ticking interval={1000} format="YYYY年MM月DD日 HH:mm" onChange={() => setWeekday(new Date().getDay())} />
              <span>{["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][weekday]}</span>
            </div>
          </footer>
        </ResizablePanel>
        {terminal && <><ResizableHandle aria-label="调整终端高度" /><ResizablePanel id="terminal" defaultSize="30%" minSize="15%"><TerminalPanel key={`${workspace.path}:${terminal.file || ""}`} root={workspace.path} file={terminal.file} /></ResizablePanel></>}
      </ResizablePanelGroup>
    </main></StatusTarget.Provider>
  )
}
