import { matchesShortcut } from "@vessel/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import Canvas from "./canvas"
import WorkspaceHome from "./workspace-home"
import { TabSwitcher } from "@/components/tab-switcher"
import { List } from "lucide-react"
import { StatusBar } from "@/components/ui/status-bar"
import { BackupStatus } from "@/components/backup-status"
import { StatusTarget } from "./status-context"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable-panels"
import { TerminalPanel } from "./terminal-panel"
import { FileSearch } from "./file-search"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import CanvasContent from '@/components/core/canvas'
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu'
import { Pin, Copy, Columns2 } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "@/components/ui/dropdown-menu"
import { File, Home, X, MoreHorizontal, ChevronLeft, ChevronRight, SquareChevronRight, SquareChevronDown, LayoutTemplate } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouterView } from "@vessel/react-router/components"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

/** 主区只负责标签导航和当前子路由出口。 */
export default function LayoutMain({ resources = false }: { resources?: boolean }) {
  const { workspace, openFiles: files, activeFilePath, openWorkspaceFile, closeWorkspaceFile, closeWorkspaceFiles, navigateToWorkspaceHome } = useWorkspace()
  const [pinned, setPinned] = useState<string[]>(() => {
    try { const value: unknown = JSON.parse(localStorage.getItem('vessel-pinned-tabs') || '[]'); return Array.isArray(value) ? value.filter((path): path is string => typeof path === 'string') : [] } catch { return [] }
  })
  const openFiles = useMemo(() => [...files].sort((a, b) => Number(pinned.includes(b.path)) - Number(pinned.includes(a.path))), [files, pinned])
  const [splitPath, setSplitPath] = useState<string | null>(null)
  const togglePin = (path: string) => setPinned(current => {
    const next = current.includes(path) ? current.filter(item => item !== path) : [...current, path]
    localStorage.setItem('vessel-pinned-tabs', JSON.stringify(next)); return next
  })
  const copyPath = (path: string, absolute: boolean) => {
    const prefix = workspace.path.replace(/[\\/]+$/, '') + (path.includes('\\') ? '\\' : '/')
    const value = absolute ? path : path.startsWith(prefix) ? path.slice(prefix.length) : path
    void navigator.clipboard.writeText(value).catch(error => toast.error(`复制失败：${String(error)}`))
  }
  useEffect(() => { if (splitPath && !files.some(file => file.path === splitPath)) setSplitPath(null) }, [files, splitPath])
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
      const previous = matchesShortcut(event, "previousTab")
      if (!previous && !matchesShortcut(event, "nextTab")) return
      event.preventDefault()
      event.stopPropagation()
      const target = activeIndex + (previous ? -1 : 1)
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
        className="flex h-12 shrink-0 items-center gap-1 border-b border-[#e6e8eb] bg-white px-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="shrink-0">
              <Button
                variant="ghost"
                size="icon"
                aria-label="上一个标签页"
                className="size-7 text-stone-500 hover:bg-emerald-700 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-emerald-700 active:!text-white"
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
          className={cn("h-[34px] shrink-0 gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors hover:bg-[#f2f3f5] hover:text-[#1f2329]", home ? "border-[#1f23290d] bg-white font-medium text-[#1f2329] shadow-[0_1px_3px_#1f23291a,0_0_0_1px_#1f23290f] hover:bg-white" : "border-transparent bg-transparent font-normal text-[#646a73]")}
        >
          <Home className="!size-3.5" />
          工作台
        </Button>
        <span aria-hidden="true" className="mx-1.5 h-5 w-px shrink-0 bg-[#e6e8eb]" />
        <div className="relative min-w-0 flex-1">
          <div
            ref={tabList}
            className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {openFiles.map((file) => {
              const active = !home && activeFilePath === file.path
              return (
                <ContextMenu key={file.path}><ContextMenuTrigger asChild><div
                  data-active={active}
                  className={cn("group flex h-[34px] shrink-0 items-center rounded-lg border pr-1 transition-colors", active ? "border-[#1f23290d] bg-white font-medium text-[#1f2329] shadow-[0_1px_3px_#1f23291a,0_0_0_1px_#1f23290f]" : "border-transparent bg-transparent text-[#646a73] hover:bg-[#f2f3f5]")}
                >
                  <Button
                    variant="ghost"
                    title={file.path}
                    aria-current={active ? "page" : undefined}
                    onClick={() => openWorkspaceFile(file)}
                    className={cn("h-[32px] min-w-0 max-w-[200px] gap-1.5 whitespace-nowrap px-2.5 text-[13px] text-inherit hover:bg-transparent hover:text-inherit", active ? "font-medium" : "font-normal")}
                  >
                    {pinned.includes(file.path) ? (
                      <Pin className="!size-[15px] text-[#646a73]" />
                    ) : /\.(excalidraw(\.md)?|canvas)$/i.test(file.name) ? (
                      <LayoutTemplate className={cn("!size-[15px]", active ? "text-amber-600" : "text-amber-500")} />
                    ) : (
                      <File className={cn("!size-[15px]", active ? "text-[#646a73]" : "text-[#8f959e]")} />
                    )}
                    <span className="truncate">{file.name}</span>
                  </Button>
                  {!pinned.includes(file.path) && <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`关闭 ${file.name}`}
                    onClick={() => closeWorkspaceFile(file.path)}
                    className={cn("size-[18px] rounded-[5px] text-[#8f959e] hover:bg-[#e4e6eb] hover:text-[#1f2329] group-hover:opacity-100 focus-visible:opacity-100", active ? "opacity-75" : "opacity-0")}
                  >
                    <X className="!size-3" />
                  </Button>}
                </div></ContextMenuTrigger><ContextMenuContent className="w-44">
                  <ContextMenuItem onSelect={() => closeWorkspaceFile(file.path)}><X />关闭</ContextMenuItem>
                  <ContextMenuItem disabled={!openFiles.some(item => item.path !== file.path && !pinned.includes(item.path))} onSelect={() => closeWorkspaceFiles(openFiles.filter(item => item.path !== file.path && !pinned.includes(item.path)).map(item => item.path))}><X />关闭其他</ContextMenuItem>
                  <ContextMenuItem onSelect={() => copyPath(file.path, false)}><Copy />复制路径</ContextMenuItem>
                  <ContextMenuItem onSelect={() => copyPath(file.path, true)}><Copy />复制绝对路径</ContextMenuItem>
                  <ContextMenuItem onSelect={() => togglePin(file.path)}><Pin />{pinned.includes(file.path) ? '取消固定' : '固定'}</ContextMenuItem>
                  <ContextMenuItem onSelect={() => setSplitPath(file.path)}><Columns2 />向右拆分</ContextMenuItem>
                </ContextMenuContent></ContextMenu>
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
                className="size-7 text-stone-500 hover:bg-emerald-700 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-emerald-700 active:!text-white"
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
        <TabSwitcher
          triggerClassName="[&:hover>button]:bg-emerald-700 [&:hover>button]:!text-white [&:hover>button_svg]:!text-white [&:hover>button_svg]:!stroke-white [&[data-state=open]>button]:bg-emerald-700 [&[data-state=open]>button]:!text-white [&[data-state=open]>button_svg]:!text-white [&[data-state=open]>button_svg]:!stroke-white"
          tabs={openFiles.map(file => ({ id: file.path, title: file.name, active: file.path === activeFilePath }))}
          onSelect={id => { const file = openFiles.find(file => file.path === id); if (file) openWorkspaceFile(file) }}
        >
          <Button
            variant="ghost"
            size="icon"
            aria-label="已打开的标签页"
            className="size-7 shrink-0 text-stone-500 hover:bg-emerald-700 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-emerald-700 active:!text-white"
          >
            <List className="!size-4" />
          </Button>
        </TabSwitcher>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="标签页操作"
                  className="size-7 shrink-0 text-stone-500 hover:bg-emerald-700 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-emerald-700 active:!text-white data-[state=open]:bg-emerald-700 data-[state=open]:!text-white data-[state=open]:[&_svg]:!text-white data-[state=open]:[&_svg]:!stroke-white"
                >
                  <MoreHorizontal className="!size-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>标签页操作</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-44 rounded-lg !bg-white p-1 [&_[role=menuitem]]:px-2 [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]]:font-normal [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700 [&_[role=menuitem][data-state=open]]:!bg-[#f0efed]">
            <DropdownMenuSub><DropdownMenuSubTrigger>标签页（{openFiles.length}）</DropdownMenuSubTrigger><DropdownMenuSubContent className="w-48 overflow-hidden !bg-white [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700"><ScrollArea className="[&_[data-radix-scroll-area-viewport]]:max-h-72 [&_[data-radix-scroll-area-viewport]>div]:!block">{openFiles.map(file => <DropdownMenuItem key={file.path} className={file.path === activeFilePath ? "bg-[#f0efed] text-stone-700" : ""} onSelect={() => openWorkspaceFile(file)}><span className="truncate">{file.name}</span></DropdownMenuItem>)}</ScrollArea></DropdownMenuSubContent></DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!activeFilePath}
              onSelect={() => closeWorkspaceFile(activeFilePath)}
            >
              关闭当前标签页
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!activeFilePath || openFiles.length < 2}
              onSelect={() => closeWorkspaceFiles(openFiles.filter((file) => file.path !== activeFilePath && !pinned.includes(file.path)).map((file) => file.path))}
            >
              关闭其他标签页
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!activeFilePath || openFiles.findIndex((file) => file.path === activeFilePath) === openFiles.length - 1}
              onSelect={() => closeWorkspaceFiles(openFiles.slice(openFiles.findIndex((file) => file.path === activeFilePath) + 1).filter(file => !pinned.includes(file.path)).map((file) => file.path))}
            >
              关闭右侧标签页
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={!openFiles.length}
              onSelect={() => closeWorkspaceFiles(openFiles.filter(file => !pinned.includes(file.path)).map((file) => file.path))}
            >
              关闭所有标签页
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <ResizablePanelGroup orientation="vertical">
        <ResizablePanel id="editor" defaultSize="70%" minSize="20%" className="flex min-h-0 flex-col">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel id="primary-document" minSize="20%" className="flex min-h-0 flex-col"><div ref={contentHost} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{resources ? (home ? <WorkspaceHome /> : <Canvas />) : <RouterView />}</div></ResizablePanel>
            {splitPath && <><ResizableHandle aria-label="调整右侧编辑区宽度" /><ResizablePanel id="split-document" defaultSize="50%" minSize="20%" className="flex min-h-0 flex-col">
              <div className="flex h-9 shrink-0 items-center gap-2 border-b px-3 text-xs text-stone-600"><File className="size-3.5" /><span className="min-w-0 flex-1 truncate" title={splitPath}>{splitPath.split(/[\\/]/).pop()}</span><Button variant="ghost" size="icon" className="size-6" aria-label="关闭右侧拆分" onClick={() => setSplitPath(null)}><X className="!size-3.5" /></Button></div>
              <StatusTarget.Provider value={null}><CanvasContent key={splitPath} activeFilePath={splitPath} workspacePath={workspace.path} fileType={splitPath.split(/[\\/]/).pop()?.split('.').slice(1).pop()} /></StatusTarget.Provider>
            </ResizablePanel></>}
          </ResizablePanelGroup>
          <StatusBar left={<>
            <Button variant="ghost" aria-pressed={!!terminal} className={`h-6 gap-1 rounded px-2 text-xs ${terminal ? "bg-green-100 text-green-700 hover:bg-green-200" : "text-stone-600 hover:bg-stone-200"}`} aria-label={terminal ? "关闭控制台" : "打开控制台"} onClick={() => setTerminal(current => current ? null : { file: home ? undefined : activeFilePath || undefined })}>
              {terminal ? <SquareChevronDown className="!size-3.5" /> : <SquareChevronRight className="!size-3.5" />}控制台
            </Button>
            {!resources && <BackupStatus workspace={workspace.path} file={activeFilePath} />}
          </>}><div ref={setStatusTarget} className="min-w-0 flex-1" /></StatusBar>
        </ResizablePanel>
        {terminal && <><ResizableHandle aria-label="调整终端高度" /><ResizablePanel id="terminal" defaultSize="30%" minSize="15%"><TerminalPanel key={`${workspace.path}:${terminal.file || ""}`} root={workspace.path} file={terminal.file} /></ResizablePanel></>}
      </ResizablePanelGroup>
    </main></StatusTarget.Provider>
  )
}
