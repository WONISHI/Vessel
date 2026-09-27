import { useEffect, useRef } from "react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { File, Home, X, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouterView } from "@vessel/react-router/components"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

/** 主区只负责标签导航和当前子路由出口。 */
export default function LayoutMain() {
  const { openFiles, activeFilePath, openWorkspaceFile, closeWorkspaceFile, closeWorkspaceFiles, navigateToWorkspaceHome } = useWorkspace()
  const location = useLocation()
  const home = location.pathname === "/editor"
  const tabList = useRef<HTMLDivElement>(null)
  useEffect(() => {
    tabList.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" })
  }, [activeFilePath, home])
  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <nav
        aria-label="已打开的标签"
        className="flex h-10 shrink-0 items-center gap-1 border-b border-[#f0efed] bg-[#faf9f7] px-2.5"
      >
        <div
          ref={tabList}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Button
            variant="ghost"
            aria-current={home ? "page" : undefined}
            onClick={navigateToWorkspaceHome}
            className={cn("h-[30px] shrink-0 rounded-lg px-3 text-xs text-stone-500 hover:bg-emerald-700 hover:text-white", home && "bg-white font-semibold text-stone-900 shadow-sm")}
          >
            <Home className="!size-3.5" />
            工作台
          </Button>
          {openFiles.map((file) => {
            const active = !home && activeFilePath === file.path
            return (
              <div
                key={file.path}
                className={cn("group flex h-[30px] shrink-0 items-center rounded-lg pr-1 text-stone-500 hover:bg-emerald-700 hover:text-white", active && "bg-white text-stone-900 shadow-sm")}
              >
                <Button
                  variant="ghost"
                  title={file.path}
                  aria-current={active ? "page" : undefined}
                  onClick={() => openWorkspaceFile(file)}
                  className="h-[30px] max-w-52 gap-1.5 px-2 text-xs text-inherit hover:bg-transparent hover:text-white group-hover:text-white"
                >
                  <File className="!size-3.5" />
                  <span className="truncate">{file.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`关闭 ${file.name}`}
                  onClick={() => closeWorkspaceFile(file.path)}
                  className="size-5 rounded text-inherit hover:bg-white/20 hover:text-white group-hover:text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <X className="!size-3" />
                </Button>
              </div>
            )
          })}
        </div>
        <DropdownMenu>
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
          <DropdownMenuContent align="end">
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
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <RouterView />
      </div>
    </main>
  )
}
