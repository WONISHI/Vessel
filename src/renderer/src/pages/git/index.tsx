import { GitOperationLoading } from "@/pages/git/components/operation-loading"
import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import LayoutActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { Button } from "@/components/ui/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable-panels"
import { DiffViewer } from "@/pages/git/components/diff-viewer"
import { AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"
import "@/pages/git/dark.css"
import { useGitPage } from "@/pages/git/hooks/use-git-page"
import { GitToolbar } from "@/pages/git/components/git-toolbar"
import { GitSidebarNav } from "@/pages/git/components/git-sidebar-nav"
import { GitStagedFiles } from "@/pages/git/components/git-staged-files"
import { GitUnstagedFiles } from "@/pages/git/components/git-unstaged-files"
import { GitCommitBar } from "@/pages/git/components/git-commit-bar"
import { GitHistoryList } from "@/pages/git/components/git-history-list"
import { GitCommitFiles } from "@/pages/git/components/git-commit-files"
import { GitDialogs } from "@/pages/git/components/git-dialogs"

/** Renders the source tree page component. */
export default function SourceTreePage() {
  const navigate = useNavigate()

  /** Handles activity change events. */
  const handleActivityChange = (act: AsideActivity) => {
    if (act === "tools") navigate("/devtools")
    else if (act === "files") navigate("/editor")
    else if (act === "git") navigate("/git")
    else if (act === "postman") navigate("/api-client")
    else navigate(`/${act}`)
  }


  const g = useGitPage()
  const { isRepo, activeTab, remoteOperation, status, branches, selectedFile, diffText, handleStageFile, handleUnstageFile, handleInitRepo } = g

  return (
    <Layout
      aside={
        <LayoutActivityBar
          activity="git"
          onActivityChange={handleActivityChange}
        />
      }
    >
      <div className="vessel-git-page relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-800">
        {/* 1. 顶部操作工具栏 (SourceTree 经典 Toolbar) */}
        <GitToolbar g={g} />

        {remoteOperation && <GitOperationLoading operation={remoteOperation} branch={branches.current} />}
        {/* 2. 主体区 (左右分栏，1号支持 Resizable 水平拖拽) */}
        <div inert={remoteOperation !== null} aria-busy={remoteOperation !== null} className="flex min-h-0 flex-1">
        <ResizablePanelGroup
          orientation="horizontal"
          className="flex-1 min-h-0 h-full w-full"
        >
          {/* 1号: 左侧边栏导航 (SourceTree 风格) */}
          <ResizablePanel
            id="git-sidebar-nav"
            defaultSize="230px"
            minSize="230px"
            className="git-navigation flex min-w-0 flex-col overflow-hidden text-xs select-none min-h-0"
          >
            <GitSidebarNav g={g} />
          </ResizablePanel>

          {/* 1号: 拖拽调节左侧边栏宽度的分割线 */}
          <ResizableHandle aria-label="调整左侧边栏宽度" />

          {/* 右侧主工作区 */}
          <ResizablePanel
            id="git-main-area"
            defaultSize="82%"
            minSize="65%"
            className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
          >
            {!isRepo ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-stone-500">
                <AlertCircle className="size-10 text-stone-300 mb-2" />
                <p className="text-sm font-semibold text-stone-700 mb-1">当前目录还不是 Git 仓库</p>
                <p className="text-stone-400 mb-4 max-w-sm">您可以将当前工作区初始化为 Git 仓库以开启版本控制。</p>
                <Button
                  size="sm"
                  onClick={handleInitRepo}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  初始化为 Git 仓库
                </Button>
              </div>
            ) : activeTab === "status" ? (
              /* 视图 1: 文件状态视图 (1号占60%，4号占40%，3号使用Resizable拖拽调整) */
              <ResizablePanelGroup
                orientation="horizontal"
                className="flex-1 min-h-0 h-full w-full"
              >
                {/* 1号: 文件列表区 (Staged + Unstaged) - 宽度为 1号+4号 之和的 60% */}
                <ResizablePanel
                  id="git-file-list"
                  defaultSize="60%"
                  minSize="20%"
                  maxSize="85%"
                  className="git-file-panel flex flex-col min-h-0 min-w-0 bg-stone-50/30"
                >
                  {/* 2号: 垂直可调整面板组 (已暂存 / 未暂存，支持 Resizable 拖拽) */}
                  <ResizablePanelGroup
                    orientation="vertical"
                    className="flex-1 min-h-0 h-full w-full"
                  >
                    {/* 已暂存区 */}
                    <ResizablePanel
                      id="git-staged-panel"
                      defaultSize="50%"
                      minSize="15%"
                      maxSize="85%"
                      className="flex flex-col min-h-0 min-w-0"
                    >
                      <GitStagedFiles g={g} />
                    </ResizablePanel>

                    {/* 2号: 拖拽调整已暂存与未暂存区域高度的分割线 */}
                    <ResizableHandle aria-label="调整暂存与未暂存区域高度" />

                    {/* 2号: 未暂存区 */}
                    <ResizablePanel
                      id="git-unstaged-panel"
                      defaultSize="50%"
                      minSize="15%"
                      maxSize="85%"
                      className="flex flex-col min-h-0 min-w-0"
                    >
                      <GitUnstagedFiles g={g} />
                    </ResizablePanel>
                  </ResizablePanelGroup>

                  {/* 底部提交输入栏 */}
                  <GitCommitBar g={g} />
                </ResizablePanel>

                {/* 3号: 拖拽调节宽度的分割线 */}
                <ResizableHandle aria-label="调整文件列表与差异查看器宽度" />

                {/* 4号: 选定文件 Diff 区域 - 占 40% */}
                <ResizablePanel
                  id="git-file-diff"
                  defaultSize="40%"
                  minSize="15%"
                  maxSize="80%"
                  className="flex min-h-0 min-w-0 flex-col overflow-hidden"
                >
                  <DiffViewer
                    diffText={diffText}
                    filePath={selectedFile?.path}
                    isStaged={status?.staged.some((f) => f.path === selectedFile?.path)}
                    onToggleStage={() => {
                      if (!selectedFile) return
                      const isStaged = status?.staged.some((f) => f.path === selectedFile.path)
                      if (isStaged) handleUnstageFile(selectedFile.path)
                      else handleStageFile(selectedFile.path)
                    }}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            ) : (
              /* 视图 2: 提交历史 (Git Graph) 视图 */
              <ResizablePanelGroup
                orientation="vertical"
                className="flex-1 min-h-0 h-full w-full"
              >
                {/* 1号: 提交拓扑图与提交列表 (带 ScrollArea 滚动条) */}
                <ResizablePanel
                  id="git-history-graph"
                  defaultSize="65%"
                  minSize="20%"
                  maxSize="85%"
                  className="flex min-h-0 flex-col"
                >
                  {/* 历史视图顶部工具条 (分支范围切换与统计) */}
                  <GitHistoryList g={g} />
                </ResizablePanel>

                {/* 3号: 拖拽调节上下高度的分割栏 */}
                <ResizableHandle aria-label="调整提交历史与详情高度" />

                {/* 选定 Commit 详情面板 */}
                <ResizablePanel
                  id="git-history-detail"
                  defaultSize="35%"
                  minSize="15%"
                  maxSize="80%"
                  className="flex min-h-0 flex-col bg-white"
                >
                  <ResizablePanelGroup
                    orientation="horizontal"
                    className="flex-1 min-h-0 h-full w-full"
                  >
                    {/* 左侧：提交详情与修改文件列表 */}
                    <ResizablePanel
                      id="git-history-commit-files"
                      defaultSize="35%"
                      minSize="20%"
                      maxSize="70%"
                      className="flex min-h-0 min-w-0 flex-col bg-white"
                    >
                      <GitCommitFiles g={g} />
                    </ResizablePanel>

                    {/* 4号: 支持水平拖拽调整宽度的 ResizableHandle */}
                    <ResizableHandle aria-label="调整提交文件列表与差异对比宽度" />

                    {/* 右侧：提交 Diff 渲染 */}
                    <ResizablePanel
                      id="git-history-commit-diff"
                      defaultSize="65%"
                      minSize="25%"
                      maxSize="80%"
                      className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-white"
                    >
                      <DiffViewer
                        diffText={diffText}
                        filePath="Commit 差异对比"
                      />
                    </ResizablePanel>
                  </ResizablePanelGroup>
                </ResizablePanel>
              </ResizablePanelGroup>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>

        </div>
        <GitDialogs g={g} />
      </div>
    </Layout>
  )
}
