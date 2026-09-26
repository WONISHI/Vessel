import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Wrench } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "../../hooks/useWorkspace"
import type { LayoutWorkspaceSidebarProps } from "./types"
import WorkspaceTree from "./workspace-tree"
import { countFiles } from "./utils"

/** 根据活动显示工作区文件树、本次打开列表或开发工具。 */
export default function LayoutWorkspaceSidebar({ activity }: LayoutWorkspaceSidebarProps) {
  const { workspace } = useWorkspace()
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  return (
    <section
      aria-label="工作区侧边栏"
      className="flex w-[240px] min-h-0 flex-col border-r border-[#f0efed]"
    >
      <header className="flex items-center justify-between px-3.5 pb-2 pt-3 text-xs font-semibold text-stone-500">
        <span>{activity === "files" ? "工作区" : activity === "recent" ? "本次打开" : "开发工具"}</span>
        <span className="text-[11px] text-stone-400">{activity === "files" ? `${countFiles(workspace.files)} 个文件` : ""}</span>
      </header>
      <ScrollArea
        viewportRef={setViewport}
        className="min-h-0 flex-1 px-2 pb-3"
      >
        {activity !== "tools" ? (
          <WorkspaceTree
            key={`${workspace.path}-${activity}`}
            viewport={viewport}
            recent={activity === "recent"}
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
