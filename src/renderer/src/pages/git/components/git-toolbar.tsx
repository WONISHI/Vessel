import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { toast } from "@/components/ui/sonner"
import { ChevronDown, Archive, ArrowDownUp, Download, FolderGit2, FolderOpen, GitBranch, GitCommit, GitPullRequest, GitFork, PanelRightClose, PanelRightOpen, Settings, SquareTerminal, RefreshCw, Upload } from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

/** 顶部操作工具栏 */
export function GitToolbar({ g }: { g: GitPageModel }) {
  const { setRepositorySettingsOpen, setTerminalOpen, repoPath, setRepoPath, libraryProjects, isRepo, setActiveTab, loading, remoteOperation, status, stashes, setCreateBranchOpen, setBranchStartPoint, setMergeBranchOpen, refresh, handleStashAll, handlePull, handlePush, handleFetch } = g
  const [toolbarToolsOpen, setToolbarToolsOpen] = useState(true)
  const toolbarToolsRef = useRef<HTMLDivElement>(null)
  const [toolbarToolsWidth, setToolbarToolsWidth] = useState(0)
  useLayoutEffect(() => {
    const node = toolbarToolsRef.current
    if (!node) return
    const measure = () => setToolbarToolsWidth(node.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return (
        <header inert={remoteOperation !== null} className="git-toolbar flex h-12 shrink-0 items-center gap-1 overflow-hidden border-b border-stone-200 bg-stone-50/70 px-3">
          <ScrollArea type="hover" className="h-9 min-w-0 flex-1">
          <div className="flex h-8 w-max items-center gap-1">
            {/* Commit 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => setActiveTab("status")}
            >
              <GitCommit className="size-4 text-green-600" />
              <span>提交</span>
            </button>

            {/* Pull 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => void handlePull()}
              disabled={loading || !isRepo}
            >
              <Download className="size-4 text-blue-600" />
              <span>拉取</span>
              {!!status?.behind && <span className="rounded-full bg-blue-100 px-1 text-[10px] text-blue-700">{status.behind}</span>}
            </button>

            {/* Push 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => void handlePush()}
              disabled={loading || !isRepo}
            >
              <Upload className="size-4 text-orange-600" />
              <span>推送</span>
              {!!status?.ahead && <span className="rounded-full bg-orange-100 px-1 text-[10px] text-orange-700">{status.ahead}</span>}
            </button>

            {/* Fetch 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => void handleFetch()}
              disabled={loading || !isRepo}
            >
              <ArrowDownUp className="size-4 text-stone-600" />
              <span>抓取</span>
            </button>

            <div role="separator" aria-orientation="vertical" className="git-toolbar-divider mx-1 h-4 w-px shrink-0 bg-stone-300" />

            {/* Branch 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => {
                setBranchStartPoint(undefined)
                setCreateBranchOpen(true)
              }}
              disabled={!isRepo}
            >
              <GitBranch className="size-4 text-indigo-600" />
              <span>分支</span>
            </button>

            {/* Merge 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => setMergeBranchOpen(true)}
              disabled={!isRepo}
            >
              <GitPullRequest className="size-4 text-purple-600" />
              <span>合并</span>
            </button>

            {/* Stash 贮藏 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={handleStashAll}
              disabled={loading || !isRepo}
              data-title="贮藏当前工作区所有修改 (git stash)"
            >
              <Archive className="size-4 text-amber-600" />
              <span>贮藏</span>
              {stashes.length > 0 && <span className="rounded-full bg-amber-100 px-1 text-[10px] text-amber-700">{stashes.length}</span>}
            </button>

            {/* Refresh 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={() => refresh()}
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>刷新</span>
            </button>
          </div>

          <ScrollBar orientation="horizontal" className="h-1" />
          </ScrollArea>

          <button
            type="button"
            className="git-toolbar-tools-toggle ml-3 flex size-8 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-200/70"
            aria-label={toolbarToolsOpen ? "收起右侧工具栏" : "展开右侧工具栏"}
            data-title={toolbarToolsOpen ? "收起右侧工具栏" : "展开右侧工具栏"}
            aria-expanded={toolbarToolsOpen}
            aria-controls="git-toolbar-tools"
            onClick={() => setToolbarToolsOpen((open) => !open)}
          >
            {toolbarToolsOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </button>
          <div id="git-toolbar-tools" className="git-toolbar-tools shrink-0 overflow-hidden" data-open={toolbarToolsOpen} inert={!toolbarToolsOpen} aria-hidden={!toolbarToolsOpen} style={{ width: toolbarToolsOpen ? toolbarToolsWidth : 0 }}>
          <div ref={toolbarToolsRef} className="git-toolbar-tools-content flex w-max items-center gap-2 pl-1">
          <div role="separator" aria-orientation="vertical" className="git-toolbar-divider mr-1 h-5 w-px shrink-0 bg-stone-300" />
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" disabled={!isRepo || loading} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-stone-700 hover:bg-stone-200/70 disabled:opacity-40" data-title="在浏览器中打开远程仓库" onClick={async () => {
              try {
                const url = await window.electronAPI.git.getRemoteWebUrl(repoPath)
                if (!url) { toast.error("未找到有效的远程仓库地址"); return }
                await window.electronAPI.openExternal(url)
              } catch (error) { toast.error("打开远程仓库失败", { description: cleanGitErrorMessage(error) }) }
            }}><GitFork className="size-4" /><span>显示远程仓库</span></button>
            <button type="button" disabled={!repoPath} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-stone-700 hover:bg-stone-200/70 disabled:opacity-40" data-title="在文件管理器中显示当前仓库" onClick={async () => {
              try { await window.electronAPI.revealWorkspaceFile(repoPath, repoPath) }
              catch (error) { toast.error("显示仓库失败", { description: cleanGitErrorMessage(error) }) }
            }}><FolderOpen className="size-4" /><span>在 Finder 中显示</span></button>
            <button type="button" disabled={!isRepo} className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-stone-700 hover:bg-stone-200/70 disabled:opacity-40" data-title="打开当前仓库的终端" onClick={() => setTerminalOpen(true)}><SquareTerminal className="size-4" /><span>终端</span></button>
            <button type="button" className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-stone-700 hover:bg-stone-200/70" data-title="当前仓库设置" disabled={!isRepo || loading} onClick={() => setRepositorySettingsOpen(true)}><Settings className="size-4" /><span>设置</span></button>
          </div>

          {/* 仓库路径指示与切换 */}
          <div className="flex shrink-0 items-center gap-2 text-xs">
            <FolderGit2 className="size-4 text-stone-500" />
            {libraryProjects.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="git-repo-switcher flex h-7 max-w-[200px] items-center gap-1.5 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-700 outline-none hover:bg-stone-50 focus-visible:border-green-500 dark:border-[#414954] dark:bg-[#1c2025] dark:text-stone-200 dark:hover:bg-[#2a3038] dark:focus-visible:border-emerald-500"
                  >
                    <span className="truncate">{libraryProjects.find((p) => p.path === repoPath)?.name || repoPath.split(/[\\/]/).pop() || "选择仓库"}</span>
                    <ChevronDown className="size-3.5 shrink-0 text-stone-400 dark:text-stone-500" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="git-repo-switcher-menu max-h-[60vh] w-56 overflow-y-auto border-stone-200 bg-white text-stone-800 dark:border-[#414954] dark:bg-[#23272d] dark:text-stone-100">
                  <DropdownMenuRadioGroup value={repoPath} onValueChange={(value) => value && setRepoPath(value)}>
                    {!libraryProjects.some((p) => p.path === repoPath) && repoPath && (
                      <DropdownMenuRadioItem checkOnRight value={repoPath} className="git-repo-switcher-item text-xs dark:focus:bg-[#2f343b] dark:focus:text-stone-100 dark:data-[state=checked]:bg-[#3a4048] dark:data-[state=checked]:text-stone-100">
                        <span className="truncate">{repoPath.split(/[\\/]/).pop()} (当前)</span>
                      </DropdownMenuRadioItem>
                    )}
                    {libraryProjects.map((p) => (
                      <DropdownMenuRadioItem checkOnRight key={p.path} value={p.path} className="git-repo-switcher-item text-xs dark:focus:bg-[#2f343b] dark:focus:text-stone-100 dark:data-[state=checked]:bg-[#3a4048] dark:data-[state=checked]:text-stone-100">
                        <span className="truncate">{p.name}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator className="dark:bg-[#414954]" />
                  <DropdownMenuItem
                    className="git-repo-switcher-item text-xs dark:focus:bg-[#2f343b] dark:focus:text-stone-100"
                    onSelect={() => {
                      void window.electronAPI.openDirectory().then((res) => {
                        if (res?.path) setRepoPath(res.path)
                      })
                    }}
                  >
                    <FolderOpen className="size-3.5" />
                    打开本地其他目录...
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span
                className="font-mono text-stone-600 truncate max-w-sm dark:text-stone-300"
              >
                {repoPath.split(/[\\/]/).pop() || "未选择仓库"}
              </span>
            )}
            <button
              type="button"
              className="text-[11px] text-stone-400 hover:text-stone-700 underline"
              onClick={async () => {
                const res = await window.electronAPI.openDirectory()
                if (res?.path) setRepoPath(res.path)
              }}
            >
              浏览...
            </button>
          </div>
          </div>
          </div>
        </header>
  )
}
