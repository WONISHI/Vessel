import { CreateEntry, type EntryDraft } from "./create-entry"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Wrench, LocateFixed } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"
import type { LayoutWorkspaceSidebarProps } from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/types"
import WorkspaceTree from "@/pages/workspace/components/layout-aside/layout-workspace-sidebar/workspace-tree"
import { countFileNodes } from "@vessel/utils"

/** 根据活动显示工作区文件树、本次打开列表或开发工具。 */
export default function LayoutWorkspaceSidebar({ activity }: LayoutWorkspaceSidebarProps) {
  const [revealPath, setRevealPath] = useState("")
  const [revision, setRevision] = useState(0)
  const [addedFiles, setAddedFiles] = useState(0)
  const { workspace, activeFilePath, expandDirectory } = useWorkspace()
  const [draft, setDraft] = useState<EntryDraft | null>(null)
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
    setRevision((value) => value + 1)
  }
  const revealCurrentFile = () => {
    if (!activeFilePath) return
    let directory = activeFilePath
    while (true) {
      const split = Math.max(directory.lastIndexOf("/"), directory.lastIndexOf("\\"))
      if (split < workspace.path.length) break
      directory = directory.slice(0, split)
      expandDirectory(directory)
    }
    setDraft(null)
    setRevealPath(activeFilePath)
    setRevision((value) => value + 1)
  }
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const navigate = useNavigate()
  const workspaceName = workspace.path.split(/[\\/]/).filter(Boolean).pop() || workspace.name
  return (
    <section
      aria-label="工作区侧边栏"
      className="flex h-full w-full min-h-0 flex-col border-r border-[#f0efed]"
    >
      <header className="flex items-center justify-between px-3.5 pb-2 pt-3 text-xs font-semibold text-stone-500">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              className="min-w-0 truncate font-semibold text-black"
            >
              {activity === "files" ? workspaceName : "开发工具"}
            </span>
          </TooltipTrigger>
          <TooltipContent>{countFileNodes(workspace.files) + addedFiles} 个文件</TooltipContent>
        </Tooltip>
        {activity === "files" && (
          <div className="flex shrink-0 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!activeFilePath}
                    aria-label="定位当前文件"
                    className="size-6 text-stone-500 hover:bg-green-600 hover:text-white"
                    onClick={revealCurrentFile}
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
        viewportRef={setViewport}
        className="min-h-0 flex-1 px-2 pb-3"
      >
        {activity !== "tools" ? (
          <WorkspaceTree
            key={`${workspace.path}-${activity}-${revision}`}
            draft={draft}
            onCreate={(parent, kind) => setDraft({parent, kind, extension: kind === "file" ? "md" : ""})}
            revealPath={revealPath}
            onRevealed={() => setRevealPath("")}
            onDraftFinish={(created) => {
              if (created && draft?.kind === "file") setAddedFiles((value) => value + 1)
              setDraft(null)
              setRevision((value) => value + 1)
            }}
            viewport={viewport}
            recent={false}
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
