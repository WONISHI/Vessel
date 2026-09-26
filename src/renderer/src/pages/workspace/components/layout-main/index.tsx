import { File, Home, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RouterView } from "@vessel/react-router/components"
import { useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

/** 主区只负责标签导航和当前子路由出口。 */
export default function LayoutMain() {
  const { openFiles, activeFilePath, openWorkspaceFile, closeWorkspaceFile, navigateToWorkspaceHome } = useWorkspace()
  const location = useLocation()
  const home = location.pathname === "/editor"
  return (
    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <nav
        aria-label="已打开的标签"
        className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-[#f0efed] bg-[#faf9f7] px-2.5 [scrollbar-width:thin]"
      >
        <Button
          variant="ghost"
          aria-current={home ? "page" : undefined}
          onClick={navigateToWorkspaceHome}
          className={cn("h-[30px] shrink-0 rounded-lg px-3 text-xs text-stone-500", home && "bg-white font-semibold text-stone-900 shadow-sm hover:bg-white")}
        >
          <Home className="!size-3.5" />
          工作台
        </Button>
        {openFiles.map((file) => {
          const active = !home && activeFilePath === file.path
          return (
            <div
              key={file.path}
              className={cn("group flex h-[30px] shrink-0 items-center rounded-lg pr-1 text-stone-500 hover:bg-stone-100", active && "bg-white text-stone-900 shadow-sm hover:bg-white")}
            >
              <Button
                variant="ghost"
                title={file.path}
                aria-current={active ? "page" : undefined}
                onClick={() => openWorkspaceFile(file)}
                className="h-[30px] max-w-52 gap-1.5 px-2 text-xs hover:bg-transparent"
              >
                <File className="!size-3.5" />
                <span className="truncate">{file.name}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`关闭 ${file.name}`}
                onClick={() => closeWorkspaceFile(file.path)}
                className="size-5 rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="!size-3" />
              </Button>
            </div>
          )
        })}
      </nav>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <RouterView />
      </div>
    </main>
  )
}
