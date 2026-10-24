import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSidebar } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CreateEntry, type EntryDraft } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry"
import type { LayoutWorkspaceSidebarProps } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/types"
import type { FileSortBy, FileSortOrder } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import WorkspaceTree from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/workspace-tree"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import { cn } from "@/lib/utils"
import { SearchPanel } from "@/pages/search/index"
import { revealSearchHit, type ContentMatch } from "@/pages/search/reveal-hit"
import { countFileNodes } from "@vessel/utils"
import { ArrowDown, ArrowDownAZ, ArrowUp, ArrowUpDown, Calendar, Check, Clock, LocateFixed, Search, Sparkles, Wrench } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

const sidebarViewCache = new Map<string, { lastActiveFilePath: string; scrollTop: number }>()

/** 根据活动显示工作区文件树、本次打开列表或开发工具。 */
export default function LayoutWorkspaceSidebar({ activity }: LayoutWorkspaceSidebarProps) {
  const [revealPath, setRevealPath] = useState("")
  const [revealCentered, setRevealCentered] = useState(false)
  const treeOpenedPath = useRef<string | null>(null)
  const movedActivePath = useRef<string | null>(null)
  const [addedFiles, setAddedFiles] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTarget, setSearchTarget] = useState("")
  const [searchHit, setSearchHit] = useState<ContentMatch | null>(null)
  const [sortBy, setSortBy] = useState<FileSortBy>(() => {
    return (localStorage.getItem("vessel:file-sort-by") as FileSortBy) || "auto"
  })
  const [sortOrder, setSortOrder] = useState<FileSortOrder>(() => {
    return (localStorage.getItem("vessel:file-sort-order") as FileSortOrder) || "asc"
  })

  /** Handles sort change events. */
  const handleSortChange = (newSortBy: FileSortBy) => {
    setSortBy(newSortBy)
    localStorage.setItem("vessel:file-sort-by", newSortBy)
    const newOrder = newSortBy === "name" || newSortBy === "auto" ? "asc" : "desc"
    setSortOrder(newOrder)
    localStorage.setItem("vessel:file-sort-order", newOrder)
  }

  /** Handles order change events. */
  const handleOrderChange = (newOrder: FileSortOrder) => {
    setSortOrder(newOrder)
    localStorage.setItem("vessel:file-sort-order", newOrder)
  }

  const { workspace, activeFilePath, expandDirectory, openWorkspaceFile } = useWorkspace()
  const [draft, setDraft] = useState<EntryDraft | null>(null)

  /** Starts entry. */
  const startEntry = (kind: EntryDraft["kind"], extension: string) => {
    const index = Math.max(activeFilePath.lastIndexOf("/"), activeFilePath.lastIndexOf("\\"))
    const parent = activeFilePath ? activeFilePath.slice(0, index) || workspace.path : workspace.path
    // 展开目标目录及祖先，确保行内输入框可见。
    let directory = parent
    while (directory.length >= workspace.path.length) {
      expandDirectory(directory)
      const split = Math.max(directory.lastIndexOf("/"), directory.lastIndexOf("\\"))
      if (split < workspace.path.length) break
      directory = directory.slice(0, split)
    }
    setDraft({ parent, kind, extension })
  }
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar()

  /** Performs the reveal current file operation. */
  const revealCurrentFile = useCallback(
    (targetPath?: string, centered = false) => {
      const path = targetPath || activeFilePath
      if (!path) return
      if (!sidebarOpen) setSidebarOpen(true)
      let directory = path
      while (true) {
        const split = Math.max(directory.lastIndexOf("/"), directory.lastIndexOf("\\"))
        if (split < workspace.path.length) break
        directory = directory.slice(0, split)
        expandDirectory(directory)
      }
      setDraft(null)
      setRevealCentered(centered)
      setRevealPath(path)
    },
    [activeFilePath, workspace.path, expandDirectory, sidebarOpen, setSidebarOpen]
  )

  useEffect(() => {
    /** Handles reveal events. */
    const handleReveal = (event: Event) => {
      const customEvent = event as CustomEvent<string>
      revealCurrentFile(customEvent.detail)
    }
    window.addEventListener("vessel:reveal-file", handleReveal)
    return () => window.removeEventListener("vessel:reveal-file", handleReveal)
  }, [revealCurrentFile])
  useEffect(() => {
    const cached = sidebarViewCache.get(workspace.path)
    if (activeFilePath && cached?.lastActiveFilePath !== activeFilePath && movedActivePath.current !== activeFilePath) {
      revealCurrentFile(activeFilePath, treeOpenedPath.current !== activeFilePath)
    }
    sidebarViewCache.set(workspace.path, {
      lastActiveFilePath: activeFilePath,
      scrollTop: cached?.scrollTop ?? 0
    })
    treeOpenedPath.current = null
    if (movedActivePath.current === activeFilePath) movedActivePath.current = null
  }, [activeFilePath, workspace.path, revealCurrentFile])
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)

  /** Attaches the scroll viewport and restores its cached scroll position. */
  const attachViewport = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        const cached = sidebarViewCache.get(workspace.path)
        if (cached && cached.scrollTop > 0) {
          element.scrollTop = cached.scrollTop
        }
      }
      setViewport(element)
    },
    [workspace.path]
  )

  useEffect(() => {
    if (!viewport) return
    /** Persists the current sidebar scroll offset for workspace re-expansion. */
    const handleScroll = () => {
      const cached = sidebarViewCache.get(workspace.path)
      sidebarViewCache.set(workspace.path, {
        lastActiveFilePath: cached?.lastActiveFilePath ?? activeFilePath,
        scrollTop: viewport.scrollTop
      })
    }
    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [viewport, workspace.path, activeFilePath])
  const navigate = useNavigate()
  const workspaceName = workspace.path.split(/[\\/]/).filter(Boolean).pop() || workspace.name

  if (activity === "files" && searchOpen) {
    return (
      <section
        aria-label="工作区全文搜索"
        className="vessel-search-sheet flex h-full w-full min-h-0 flex-col bg-white"
      >
        <SearchPanel
          title="全文搜索"
          root={searchTarget || workspace.path}
          allowChangeFolder={false}
          selected={searchHit}
          onClose={() => setSearchOpen(false)}
          onSelect={(match) => {
            setSearchHit(match)
            openWorkspaceFile({
              name: match.path.split(/[\\/]/).pop() || match.path,
              path: match.path,
              type: "file"
            } as WorkspaceNode)
            revealSearchHit(match)
          }}
        />
      </section>
    )
  }

  return (
    <section
      aria-label="工作区侧边栏"
      className="flex h-full w-full min-h-0 flex-col"
    >
      <header className="flex items-center justify-between px-3.5 pb-2 pt-3 text-xs font-semibold text-stone-500">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="min-w-0 truncate font-semibold text-black dark:text-white"
            >
              {activity === "files" ? workspaceName : "开发工具"}
            </span>
          </TooltipTrigger>
          <TooltipContent>{countFileNodes(workspace.files) + addedFiles} 个文件</TooltipContent>
        </Tooltip>
        {activity === "files" && (
          <div className="flex shrink-0 items-center">
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="排序方式"
                      className="size-6 text-stone-500 hover:bg-green-600 hover:text-white"
                    >
                      <ArrowUpDown className="!size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">排序方式</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="start"
                className="w-44 rounded-lg !bg-white p-1 text-xs shadow-md [&_[role=menuitem]:focus]:!bg-green-600 [&_[role=menuitem]:focus]:!text-white [&_[role=menuitem][data-highlighted]]:!bg-green-600 [&_[role=menuitem][data-highlighted]]:!text-white [&_[role=menuitem]:focus_svg]:!text-white [&_[role=menuitem][data-highlighted]_svg]:!text-white"
              >
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortBy === "auto" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleSortChange("auto")}
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    自动排序
                  </span>
                  {sortBy === "auto" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortBy === "ctime" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleSortChange("ctime")}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    按创建时间排序
                  </span>
                  {sortBy === "ctime" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortBy === "name" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleSortChange("name")}
                >
                  <span className="flex items-center gap-2">
                    <ArrowDownAZ className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    按名字排序
                  </span>
                  {sortBy === "name" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortBy === "mtime" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleSortChange("mtime")}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    按修改时间排序
                  </span>
                  {sortBy === "mtime" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs whitespace-nowrap cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortOrder === "desc" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleOrderChange("desc")}
                >
                  <span className="flex items-center gap-2">
                    <ArrowDown className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    降序（{sortBy === "auto" ? "从大到小" : sortBy === "name" ? "Z 到 A" : "从新到旧"}）
                  </span>
                  {sortOrder === "desc" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn("group/item flex items-center justify-between py-1.5 text-xs whitespace-nowrap cursor-pointer focus:!bg-green-600 focus:!text-white data-[highlighted]:!bg-green-600 data-[highlighted]:!text-white", sortOrder === "asc" && "font-medium text-green-700 bg-green-50/60")}
                  onClick={() => handleOrderChange("asc")}
                >
                  <span className="flex items-center gap-2">
                    <ArrowUp className="size-3.5 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />
                    升序（{sortBy === "auto" ? "从小到大" : sortBy === "name" ? "A 到 Z" : "从旧到新"}）
                  </span>
                  {sortOrder === "asc" && <Check className="size-3.5 text-green-600 group-focus/item:!text-white group-data-[highlighted]/item:!text-white" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="全文搜索"
                    className="size-6 text-stone-500 hover:bg-green-600 hover:text-white"
                    onClick={() => {
                      setSearchTarget(workspace.path)
                      setSearchOpen(true)
                    }}
                  >
                    <Search className="!size-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">全文搜索</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!activeFilePath}
                    aria-label="定位当前文件"
                    className="size-6 text-stone-500 hover:bg-green-600 hover:text-white"
                    onClick={() => revealCurrentFile(undefined, true)}
                  >
                    <LocateFixed className="!size-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">定位当前文件</TooltipContent>
            </Tooltip>
            <CreateEntry
              kind="directory"
              onStart={() => startEntry("directory", "")}
            />
            <CreateEntry
              kind="file"
              onStart={(extension) => startEntry("file", extension)}
            />
          </div>
        )}
      </header>
      <ScrollArea
        viewportRef={attachViewport}
        className="min-h-0 flex-1 px-2 pb-3"
      >
        {activity !== "tools" ? (
          <WorkspaceTree
            key={`${workspace.path}-${activity}`}
            draft={draft}
            onCreate={(parent, kind, extension = "") => setDraft({ parent, kind, extension })}
            onSearchDirectory={(path) => {
              setSearchTarget(path)
              setSearchOpen(true)
            }}
            onActiveFileMoved={(path) => { movedActivePath.current = path }}
            onFileActivate={(path) => { if (path !== activeFilePath) treeOpenedPath.current = path }}
            revealPath={revealPath}
            revealCentered={revealCentered}
            onRevealed={() => setRevealPath("")}
            onDraftFinish={(created) => {
              if (created && draft?.kind === "file") setAddedFiles((value) => value + 1)
              const savedScroll = viewport?.scrollTop
              setDraft(null)
              if (savedScroll !== undefined && viewport) {
                requestAnimationFrame(() => {
                  if (viewport && viewport.scrollTop !== savedScroll) {
                    viewport.scrollTop = savedScroll
                  }
                })
              }
            }}
            viewport={viewport}
            recent={false}
            sortBy={sortBy}
            sortOrder={sortOrder}
          />
        ) : (
          <div className="space-y-1">
            {[
              { path: "console", name: "控制台" },
              { path: "storage", name: "数据存储" }
            ].map((tool) => (
              <Button
                key={tool.path}
                variant="ghost"
                className="h-9 w-full justify-start text-xs"
                onClick={() => navigate(`/devtools/${tool.path}`)}
              >
                <Wrench className="size-4 text-stone-400" />
                {tool.name}
              </Button>
            ))}
          </div>
        )}
      </ScrollArea>
    </section>
  )
}
