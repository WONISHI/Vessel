import { WorkspaceVisible } from "./document-cache"
import { canOpenInDefaultBrowser } from "../../../../../../shared/browser-preview"
import { addTransitFile } from "@/components/transit/state"
import { FileThemeIcon } from "@/features/file-icons"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { BackupStatus } from "@/components/backup-status"
import CanvasContent from "@/components/core/canvas/index"
import { TabSwitcher } from "@/components/tab-switcher"
import { Button } from "@/components/ui/button"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import { RouteLoading } from "@/components/ui/route-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { StatusBar } from "@/components/ui/status-bar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DocumentTabs } from "@/components/workspace/components/layout-main/document-tabs"
import { FileSearch } from "@/components/workspace/components/layout-main/file-search"
import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import { TerminalPanel } from "@/components/workspace/components/layout-main/terminal-panel"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { RouterView } from "@vessel/react-router/components"
import { localFileURL, matchesShortcut } from "@vessel/utils"
import { ArrowLeftRight, ChevronLeft, ChevronRight, Columns2, Copy, FileDown, File, FolderOpen, Globe, Home, LayoutTemplate, List, MoreHorizontal, Pin, SquareTerminal, X } from "lucide-react"
import { Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"



const PdfExportDialog = lazyWithRetry(() => import("@/components/pdf-export/pdf-export-dialog"))

const WorkspaceHome = lazyWithRetry(() => import("@/components/workspace/components/layout-main/workspace-home"))

/** 主区只负责标签导航和当前子路由出口。 */
export default function LayoutMain({ resources = false }: { resources?: boolean }) {
  const { workspace, openFiles: files, activeFilePath, openWorkspaceFile, closeWorkspaceFile, closeWorkspaceFiles, navigateToWorkspaceHome } = useWorkspace()
  const [pinned, setPinned] = useState<string[]>(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("vessel-pinned-tabs") || "[]")
      return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string") : []
    } catch {
      return []
    }
  })
  const openFiles = useMemo(() => [...files].sort((a, b) => Number(pinned.includes(b.path)) - Number(pinned.includes(a.path))), [files, pinned])
  const [pdfExportPath, setPdfExportPath] = useState<string | null>(null)
  const [splitTabs, setSplitTabs] = useState<{ id: string; root: string; primary: string; secondary: string; side: "left" | "right" }[]>([])
  const [activeSplitId, setActiveSplitId] = useState<string | null>(null)
  const validSplits = splitTabs.filter((split) => split.root === workspace.path && files.some((file) => file.path === split.primary) && files.some((file) => file.path === split.secondary))
  const activeSplit = validSplits.find((split) => split.id === activeSplitId && split.primary === activeFilePath)
  const splitPath = activeSplit?.secondary ?? null
  const splitSide = activeSplit?.side ?? "right"
  const displayTabs = [
    ...openFiles.map((file) => ({ id: file.path, file, split: undefined as typeof activeSplit })),
    ...validSplits.map((split) => ({ id: split.id, file: files.find((file) => file.path === split.primary)!, split }))
  ]
  const selectTab = (id: string) => {
    const entry = displayTabs.find((entry) => entry.id === id)
    if (!entry) return
    setActiveSplitId(entry.split?.id ?? null)
    openWorkspaceFile(entry.file)
  }
  const closeTab = (id: string) => {
    const entry = displayTabs.find((entry) => entry.id === id)
    if (entry?.split) {
      setSplitTabs((current) => current.filter((split) => split.id !== id))
      if (activeSplitId === id) setActiveSplitId(null)
    } else closeWorkspaceFile(id)
  }
  const closeTabs = (ids: string[]) => {
    setSplitTabs((current) => current.filter((split) => !ids.includes(split.id)))
    if (activeSplitId && ids.includes(activeSplitId)) setActiveSplitId(null)
    const retained = validSplits.filter((split) => !ids.includes(split.id))
    closeWorkspaceFiles(ids.filter((id) => !id.startsWith("split:") && !retained.some((split) => split.primary === id || split.secondary === id)))
  }
  const createSplit = useCallback((path: string, side: "left" | "right") => {
    const primary = files.find((file) => file.path === activeFilePath) ?? files.find((file) => file.path === path)
    if (!primary || !files.some((file) => file.path === path)) return
    const id = `split:${crypto.randomUUID()}`
    setSplitTabs((current) => [...current, { id, root: workspace.path, primary: primary.path, secondary: path, side }])
    setActiveSplitId(id)
    openWorkspaceFile(primary)
  }, [activeFilePath, files, workspace.path, openWorkspaceFile])
  useEffect(() => {
    const split = (event: Event) => {
      const detail = (event as CustomEvent<{ root: string; path: string; side: "left" | "right" }>).detail
      if (detail.root === workspace.path && ["left", "right"].includes(detail.side)) createSplit(detail.path, detail.side)
    }
    window.addEventListener("vessel:split-document", split)
    return () => window.removeEventListener("vessel:split-document", split)
  }, [workspace.path, createSplit])

  /** Toggles pin. */
  const togglePin = (path: string) =>
    setPinned((current) => {
      const next = current.includes(path) ? current.filter((item) => item !== path) : [...current, path]
      localStorage.setItem("vessel-pinned-tabs", JSON.stringify(next))
      return next
    })

  /** Copies path. */
  const copyPath = (path: string, absolute: boolean) => {
    const prefix = workspace.path.replace(/[\\/]+$/, "") + (path.includes("\\") ? "\\" : "/")
    const value = absolute ? path : path.startsWith(prefix) ? path.slice(prefix.length) : path
    void navigator.clipboard.writeText(value).catch((error) => toast.error(`复制失败：${String(error)}`))
  }
  const [statusTarget, setStatusTarget] = useState<HTMLDivElement | null>(null)
  const [terminal, setTerminal] = useState(false)
  const location = useLocation()
  const graphPage = !resources && location.pathname === "/editor/graph"
  const workspaceVisible = useContext(WorkspaceVisible)
  useEffect(() => {
    const current = resources ? /^\/resources(\/|$)/.test(location.pathname) : /^\/editor(\/|$)/.test(location.pathname)
    if (!workspaceVisible || !current || graphPage) return
    const openConsole = () => {
      if (contentHost.current?.getClientRects().length) setTerminal(true)
    }
    const toggleConsole = () => {
      if (contentHost.current?.getClientRects().length) setTerminal(value => !value)
    }
    const publishConsole = () => {
      if (contentHost.current?.getClientRects().length) window.dispatchEvent(new CustomEvent("vessel:workspace-console-state", { detail: terminal }))
    }
    window.addEventListener("vessel:open-workspace-console", openConsole)
    window.addEventListener("vessel:toggle-workspace-console", toggleConsole)
    window.addEventListener("vessel:request-workspace-console-state", publishConsole)
    publishConsole()
    return () => {
      window.removeEventListener("vessel:open-workspace-console", openConsole)
      window.removeEventListener("vessel:toggle-workspace-console", toggleConsole)
      window.removeEventListener("vessel:request-workspace-console-state", publishConsole)
    }
  }, [workspaceVisible, resources, location.pathname, graphPage, terminal])
  const home = resources ? !activeFilePath : ["/editor", "/resources"].includes(location.pathname)
  const [edges, setEdges] = useState({ left: false, right: false })
  const tabList = useRef<HTMLDivElement>(null)
  const contentHost = useRef<HTMLDivElement>(null)
  const activeTabId = activeSplit?.id ?? activeFilePath
  const activeIndex = home || graphPage ? -1 : displayTabs.findIndex((entry) => entry.id === activeTabId)
  useEffect(() => {
    /** Handles shortcut events. */
    const handleShortcut = (event: KeyboardEvent) => {
      if (!contentHost.current?.getClientRects().length) return
      const previous = matchesShortcut(event, "previousTab")
      if (!previous && !matchesShortcut(event, "nextTab")) return
      event.preventDefault()
      event.stopPropagation()
      const target = activeIndex + (previous ? -1 : 1)
      if (activeIndex >= 0 && target >= 0 && target < displayTabs.length) selectTab(displayTabs[target].id)
    }
    window.addEventListener("keydown", handleShortcut, true)
    return () => window.removeEventListener("keydown", handleShortcut, true)
  }, [activeIndex, displayTabs, openWorkspaceFile])
  useEffect(() => {
    const list = tabList.current
    if (!list) return

    /** Updates edges. */
    const updateEdges = () => setEdges({ left: list.scrollLeft > 1, right: list.scrollLeft + list.clientWidth < list.scrollWidth - 1 })
    list.addEventListener("scroll", updateEdges)

    /** Performs the reveal operation. */
    const reveal = () => {
      updateEdges()
      const tab = list.querySelector<HTMLElement>('[data-active="true"]')
      if (!tab) return
      const bounds = list.getBoundingClientRect()
      const rect = tab.getBoundingClientRect()
      if (rect.left < bounds.left) list.scrollBy({ left: rect.left - bounds.left - 4, behavior: activeSplitId ? "instant" : "smooth" })
      else if (rect.right > bounds.right) list.scrollBy({ left: rect.right - bounds.right + 4, behavior: activeSplitId ? "instant" : "smooth" })
    }
    const frame = requestAnimationFrame(reveal)
    const observer = new ResizeObserver(reveal)
    observer.observe(list)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      list.removeEventListener("scroll", updateEdges)
    }
  }, [activeFilePath, activeSplitId, home, displayTabs.length])
  // Panel styles target its inner wrapper; order the actual keyed panels around the separator.
  const documentPanels = [
    <ResizablePanel
      key="primary-document"
      id="primary-document"
      minSize="20%"
      className="flex min-h-0 min-w-0 flex-col"
    >
      <div
        ref={contentHost}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        <DocumentTabs files={files} activePath={activeFilePath} workspacePath={workspace.path} home={home || graphPage}>
          {resources ? <Suspense fallback={<RouteLoading icon={<FolderOpen />} title="正在加载项目资源库" label="正在准备工作区，请稍候…" />}><WorkspaceHome /></Suspense> : <RouterView />}
        </DocumentTabs>
      </div>
    </ResizablePanel>,
    ...(splitPath && !graphPage ? [
      <ResizableHandle key="document-divider" className="workspace-document-divider" aria-label="调整拆分编辑区宽度" title="拖动调整左右宽度" />,
      <ResizablePanel
        key="split-document"
        id="split-document"
        defaultSize="50%"
        minSize="20%"
        className="flex min-h-0 min-w-0 flex-col"
      >
        <StatusTarget.Provider value={null}>
          <CanvasContent
            key={splitPath}
            activeFilePath={splitPath}
            workspacePath={workspace.path}
            fileType={splitPath.split(/[\\/]/).pop()?.split(".").slice(1).pop()}
          />
        </StatusTarget.Provider>
      </ResizablePanel>
    ] : [])
  ]
  return (
    <StatusTarget.Provider value={statusTarget}>
      <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        {!graphPage && <nav
          aria-label="已打开的标签"
          className="flex h-12 shrink-0 items-center gap-1 border-b border-[#e6e8eb] dark:border-[#444c56] bg-white px-2.5"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="上一个标签页"
                  className="size-7 text-stone-500 hover:bg-green-600 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-green-600 active:!text-white"
                  disabled={activeIndex <= 0}
                  onClick={() => selectTab(displayTabs[activeIndex - 1].id)}
                >
                  <ChevronLeft className="!size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              上一个标签页 <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl+L</kbd>
            </TooltipContent>
          </Tooltip>
          <Button
            variant="ghost"
            aria-current={home ? "page" : undefined}
            onClick={() => { setActiveSplitId(null); navigateToWorkspaceHome() }}
            className={cn(
              "workspace-home-tab h-[34px] shrink-0 gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors hover:bg-[#f2f3f5] hover:text-[#1f2329]",
              home ? "border-[#1f23290d] bg-white font-medium text-[#1f2329] shadow-[0_1px_3px_#1f23291a,0_0_0_1px_#1f23290f] hover:bg-white" : "border-transparent bg-transparent font-normal text-[#646a73]"
            )}
          >
            <Home className="!size-3.5" />
            工作台
          </Button>
          <span
            aria-hidden="true"
            className="mx-1.5 h-5 w-px shrink-0 bg-[#e6e8eb] dark:bg-[#444c56]"
          />
          <div className="relative min-w-0 flex-1" style={{ containerType: "inline-size" }}>
            <div
              ref={tabList}
              className="relative flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-2 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {displayTabs.map(({ id, file, split }) => {
                const active = !home && !graphPage && activeTabId === id
                const splitName = files.find((item) => item.path === split?.secondary)?.name ?? ""
                const normRoot = workspace.path.replace(/\\/g, "/").replace(/\/+$/, "")
                const normPath = file.path.replace(/\\/g, "/")
                const rootName = normRoot.split("/").filter(Boolean).pop() || workspace.name || ""
                const tabTitle = normRoot && normPath.startsWith(normRoot + "/") ? `${rootName ? `${rootName}/` : ""}${normPath.slice(normRoot.length + 1)}` : file.path
                return (
                  <ContextMenu key={id}>
                    <ContextMenuTrigger asChild>
                      <div
                        data-active={active}
                        data-workspace-tab="true"
                        data-split-tab={split ? "true" : undefined}
                        style={split ? { maxWidth: "calc(100cqw - 16px)" } : undefined}
                        className={cn(
                          "group flex h-[34px] shrink-0 items-center rounded-lg border pr-1 transition-colors",
                          active ? "border-[#1f23290d] bg-white font-medium text-[#1f2329] shadow-[0_1px_3px_#1f23291a,0_0_0_1px_#1f23290f]" : "border-transparent bg-transparent text-[#646a73] hover:bg-[#f2f3f5]"
                        )}
                      >
                        <Button
                          variant="ghost"
                          data-title={split ? `${tabTitle} ↔ ${split.secondary}` : tabTitle}
                          data-title-side="bottom"
                          aria-current={active ? "page" : undefined}
                          onClick={() => selectTab(id)}
                          className={cn("h-[32px] min-w-0 gap-1.5 whitespace-nowrap px-2.5 text-[13px] text-inherit hover:bg-transparent hover:text-inherit", split ? "max-w-[360px] shrink" : "max-w-[200px]", active ? "font-medium" : "font-normal")}
                        >
                          {pinned.includes(file.path) ? (
                            <Pin className="!size-[15px] text-[#646a73]" />
                          ) : <FileThemeIcon name={file.path} className="!size-[15px] shrink-0 object-contain" fallback={/\.(excalidraw(\.md)?|canvas)$/i.test(file.name) ? <LayoutTemplate className={cn("!size-[15px]", active ? "text-amber-600" : "text-amber-500")} /> : <File className={cn("!size-[15px]", active ? "text-[#646a73]" : "text-[#8f959e]")} />} />}

                          <span className="truncate">{file.name}</span>
                          {split && <>
                            <ArrowLeftRight aria-label="左右拆分" className="!size-3.5 shrink-0 text-stone-400" />
                            <span className="truncate">{splitName}</span>
                          </>}
                        </Button>
                        {(split || !pinned.includes(file.path)) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={split ? `关闭拆分 ${file.name} ↔ ${splitName}` : `关闭 ${file.name}`}
                            onClick={() => closeTab(id)}
                            className={cn("workspace-tab-close size-[18px] shrink-0 rounded-[5px] text-[#8f959e] hover:bg-transparent hover:text-inherit group-hover:opacity-100 focus-visible:opacity-100", active ? "opacity-75" : "opacity-0")}
                          >
                            <X className="!size-3" />
                          </Button>
                        )}
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-44">
                      <ContextMenuItem onSelect={() => closeTab(id)}>
                        <X />
                        关闭
                      </ContextMenuItem>
                      <ContextMenuItem
                        disabled={displayTabs.length < 2}
                        onSelect={() => closeTabs(displayTabs.filter((item) => item.id !== id && (item.split || !pinned.includes(item.file.path))).map((item) => item.id))}
                      >
                        <X />
                        关闭其他
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => {
                        void navigator.clipboard.writeText(file.name).catch((error) => toast.error(`复制失败：${String(error)}`))
                      }}>
                        <Copy />
                        复制文件名
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => {
                        void window.electronAPI.revealWorkspaceFile(workspace.path, file.path).catch((error) => toast.error(String(error)))
                      }}>
                        <FolderOpen />
                        在资源管理器中显示
                      </ContextMenuItem>
                      {canOpenInDefaultBrowser(file.name) && <ContextMenuItem onSelect={() => {
                        void window.electronAPI.openExternal(localFileURL(file.path)).catch((error) => toast.error(String(error)))
                      }}><Globe />在默认浏览器中打开</ContextMenuItem>}
                      {/\.(md|markdown)$/i.test(file.name) && !/\.excalidraw\.md$/i.test(file.name) && (
                        <ContextMenuItem onSelect={() => setPdfExportPath(file.path)}>
                          <FileDown />
                          导出 PDF…
                        </ContextMenuItem>
                      )}
                      <ContextMenuItem onSelect={() => {
                        try {
                          addTransitFile(workspace.path, file.path, file.name)
                        } catch (error) {
                          toast.error(String(error))
                        }
                      }}>
                        <Pin />
                        加入中转站
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => copyPath(file.path, false)}>
                        <Copy />
                        复制路径
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => copyPath(file.path, true)}>
                        <Copy />
                        复制绝对路径
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => togglePin(file.path)}>
                        <Pin />
                        {pinned.includes(file.path) ? "取消固定" : "固定"}
                      </ContextMenuItem>
                      {!split && <ContextMenuItem onSelect={() => createSplit(file.path, "right")}>
                        <Columns2 />
                        向右拆分
                      </ContextMenuItem>}
                    </ContextMenuContent>
                  </ContextMenu>
                )
              })}
            </div>
            {edges.left && (
              <span
                aria-hidden="true"
                className="workspace-tab-edge workspace-tab-edge-left pointer-events-none absolute inset-y-0 left-0 z-10 w-2 bg-gradient-to-r from-stone-200/20 to-transparent"
              />
            )}
            {edges.right && (
              <span
                aria-hidden="true"
                className="workspace-tab-edge workspace-tab-edge-right pointer-events-none absolute inset-y-0 right-0 z-10 w-2 bg-gradient-to-l from-stone-200/20 to-transparent"
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
                  className="size-7 text-stone-500 hover:bg-green-600 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-green-600 active:!text-white"
                  disabled={activeIndex < 0 || activeIndex >= displayTabs.length - 1}
                  onClick={() => selectTab(displayTabs[activeIndex + 1].id)}
                >
                  <ChevronRight className="!size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              下一个标签页 <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl+R</kbd>
            </TooltipContent>
          </Tooltip>
          {!home && !graphPage && activeFilePath && (
            <FileSearch
              key={activeFilePath}
              path={activeFilePath}
              contentHost={contentHost}
            />
          )}
          <TabSwitcher
            triggerClassName="[&:hover>button]:bg-green-600 [&:hover>button]:!text-white [&:hover>button_svg]:!text-white [&:hover>button_svg]:!stroke-white [&[data-state=open]>button]:bg-green-600 [&[data-state=open]>button]:!text-white [&[data-state=open]>button_svg]:!text-white [&[data-state=open]>button_svg]:!stroke-white"
            tabs={displayTabs.map(({ id, file, split }) => ({ id, title: split ? `${file.name} ↔ ${files.find((item) => item.path === split.secondary)?.name ?? ""}` : file.name, active: id === activeTabId, icon: <FileThemeIcon name={file.path} className="size-3.5 shrink-0 object-contain" fallback={<File className={cn("size-3.5", getFilePresentation(file.name).color)} />} /> }))}
            onSelect={selectTab}
          >
            <Button
              variant="ghost"
              size="icon"
              aria-label="已打开的标签页"
              className="size-7 shrink-0 text-stone-500 hover:bg-green-600 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-green-600 active:!text-white"
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
                    className="size-7 shrink-0 text-stone-500 hover:bg-green-600 hover:!text-white hover:[&_svg]:!text-white hover:[&_svg]:!stroke-white active:bg-green-600 active:!text-white data-[state=open]:bg-green-600 data-[state=open]:!text-white data-[state=open]:[&_svg]:!text-white data-[state=open]:[&_svg]:!stroke-white"
                  >
                    <MoreHorizontal className="!size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">标签页操作</TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              align="end"
              className="w-44 rounded-lg !bg-white p-1 [&_[role=menuitem]]:px-2 [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]]:font-normal [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700 [&_[role=menuitem][data-state=open]]:!bg-[#f0efed]"
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>标签页（{displayTabs.length}）</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48 overflow-hidden !bg-white [&_[role=menuitem]]:py-1.5 [&_[role=menuitem]]:text-xs [&_[role=menuitem]:focus]:!bg-[#f0efed] [&_[role=menuitem]:focus]:!text-stone-700">
                  <ScrollArea className="[&_[data-radix-scroll-area-viewport]]:max-h-72 [&_[data-radix-scroll-area-viewport]>div]:!block">
                    {displayTabs.map(({ id, file, split }) => (
                      <DropdownMenuItem
                        key={id}
                        className={id === activeTabId ? "bg-[#f0efed] text-stone-700" : ""}
                        onSelect={() => selectTab(id)}
                      >
                        <span className="truncate">{file.name}{split ? ` ↔ ${files.find((item) => item.path === split.secondary)?.name ?? ""}` : ""}</span>
                      </DropdownMenuItem>
                    ))}
                  </ScrollArea>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!activeFilePath}
                onSelect={() => closeTab(activeTabId)}
              >
                关闭当前标签页
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!activeFilePath || displayTabs.length < 2}
                onSelect={() => closeTabs(displayTabs.filter((entry) => entry.id !== activeTabId && (entry.split || !pinned.includes(entry.file.path))).map((entry) => entry.id))}
              >
                关闭其他标签页
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={activeIndex < 0 || activeIndex >= displayTabs.length - 1}
                onSelect={() => closeTabs(displayTabs.slice(activeIndex + 1).filter((entry) => entry.split || !pinned.includes(entry.file.path)).map((entry) => entry.id))}
              >
                关闭右侧标签页
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!openFiles.length}
                onSelect={() => closeTabs(displayTabs.filter((entry) => entry.split || !pinned.includes(entry.file.path)).map((entry) => entry.id))}
              >
                关闭所有标签页
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>}
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel
            id="editor"
            defaultSize="70%"
            minSize="20%"
            className="flex min-h-0 flex-col"
          >
            <ResizablePanelGroup orientation="horizontal" className="h-full min-w-0">
              {splitSide === "left" ? [...documentPanels].reverse() : documentPanels}
            </ResizablePanelGroup>
            <StatusBar
              left={!graphPage && (
                <>
                  <Button
                    variant="ghost"
                    aria-pressed={!!terminal}
                    className={`h-6 gap-1 rounded px-2 text-xs ${terminal ? "bg-green-100 text-green-700 hover:bg-green-200" : "text-stone-600 hover:bg-stone-200"}`}
                    aria-label={terminal ? "关闭控制台" : "打开控制台"}
                    onClick={() => setTerminal((current) => !current)}
                  >
                    <SquareTerminal className="!size-3.5" />
                    控制台
                  </Button>
                  {!resources && (
                    <BackupStatus
                      workspace={workspace.path}
                      file={activeFilePath}
                    />
                  )}
                </>
              )}
            >
              <div
                ref={setStatusTarget}
                className="min-w-0 flex-1"
              />
            </StatusBar>
          </ResizablePanel>
          {terminal && !graphPage && (
            <>
              <ResizableHandle aria-label="调整终端高度" />
              <ResizablePanel
                id="terminal"
                defaultSize="30%"
                minSize="15%"
              >
                <TerminalPanel
                  key={workspace.path}
                  root={workspace.path}
                  file={home ? undefined : activeFilePath || undefined}
                  onClose={() => setTerminal(false)}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
        {pdfExportPath && (
          <Suspense fallback={null}>
            <PdfExportDialog key={pdfExportPath} path={pdfExportPath} root={workspace.path} onClose={() => setPdfExportPath(null)} />
          </Suspense>
        )}
      </main>
    </StatusTarget.Provider>
  )
}
