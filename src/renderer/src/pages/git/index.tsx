import { useEffect, useState, useCallback } from "react"
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  FolderGit2,
  CheckCircle2,
  Clock,
  Layers,
  ArrowDownUp,
  FileText,
  AlertCircle,
  Copy,
  FolderOpen,
  RotateCcw,
  Tag,
  Undo2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/sonner"
import type {
  GitStatusResult,
  GitCommitItem,
  GitCommitDetail,
  GitFileStatus
} from "../../../../main/modules/git/git-service"
import { DiffViewer } from "./diff-viewer"
import { computeGitTopology, GitGraphSvg } from "./git-graph"
import { CreateBranchDialog, MergeBranchDialog } from "./branch-dialog"
import Layout from "@/layout"
import LayoutActivityBar from "@/layout/activity-bar"
import type { AsideActivity } from "@/layout/activity-bar/activity"
import { useNavigate } from "react-router-dom"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable-panels"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from "@/components/ui/context-menu"

/**
 * 优先读取项目资源库中打开的项目路径
 */
function getInitialRepoPath(): string {
  try {
    const resource = JSON.parse(localStorage.getItem("resource_current_project") || "null")
    if (resource?.path) return resource.path
  } catch {}

  try {
    const meta = JSON.parse(localStorage.getItem("vessel:library-meta") || "{}")
    if (meta?.lastPinned?.path) return meta.lastPinned.path
    if (meta?.pins?.[0]?.path) return meta.pins[0].path
  } catch {}

  try {
    const ws = JSON.parse(localStorage.getItem("app_current_workspace") || "null")
    if (ws?.path) return ws.path
  } catch {}

  return ""
}

function cleanGitErrorMessage(e: any): string {
  if (!e) return "未知错误"
  const msg = typeof e === "string" ? e : e.message || String(e)
  return msg
    .replace(/^Error invoking remote method '[^']+':\s*/, "")
    .replace(/^Error:\s*/, "")
    .trim()
}

export default function SourceTreePage() {
  const navigate = useNavigate()
  const handleActivityChange = (act: AsideActivity) => {
    if (act === "tools") navigate("/devtools")
    else if (act === "files") navigate("/editor")
    else if (act === "git") navigate("/git")
    else if (act === "postman") navigate("/api-client")
    else navigate(`/${act}`)
  }

  const [repoPath, setRepoPath] = useState<string>(getInitialRepoPath)
  const [libraryProjects, setLibraryProjects] = useState<{ name: string; path: string }[]>([])

  useEffect(() => {
    const updateProjects = () => {
      window.electronAPI.getAppState<Array<{ name: string; path: string }>>("project-library")
        .then((saved) => {
          if (Array.isArray(saved)) setLibraryProjects(saved.filter((p) => p.path && p.name))
        })
        .catch(() => {})
    }
    updateProjects()

    const onResourceChanged = () => {
      updateProjects()
      try {
        const resource = JSON.parse(localStorage.getItem("resource_current_project") || "null")
        if (resource?.path && resource.path !== repoPath) {
          setRepoPath(resource.path)
        }
      } catch {}
    }
    window.addEventListener("vessel:resource-changed", onResourceChanged)
    return () => window.removeEventListener("vessel:resource-changed", onResourceChanged)
  }, [repoPath])

  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState<"status" | "history">("status")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [branches, setBranches] = useState<{ local: string[]; remote: string[]; current: string }>({
    local: [],
    remote: [],
    current: ""
  })
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [selectedCommitIndex, setSelectedCommitIndex] = useState(0)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)

  // 选中的文件与 Diff
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null)
  const [diffText, setDiffText] = useState("")

  // Commit 表单
  const [commitMessage, setCommitMessage] = useState("")
  const [isAmend, setIsAmend] = useState(false)

  // 弹窗状态
  const [createBranchOpen, setCreateBranchOpen] = useState(false)
  const [branchStartPoint, setBranchStartPoint] = useState<string | undefined>(undefined)
  const [mergeBranchOpen, setMergeBranchOpen] = useState(false)

  // 刷新当前仓库数据
  const refresh = useCallback(async () => {
    if (!repoPath) {
      setIsRepo(false)
      return
    }
    setLoading(true)
    try {
      const git = window.electronAPI.git
      const valid = await git.isRepo(repoPath)
      setIsRepo(valid)
      if (!valid) {
        setLoading(false)
        return
      }

      const [statusRes, branchRes, logRes] = await Promise.all([
        git.getStatus(repoPath),
        git.getBranches(repoPath),
        git.getLog(repoPath, 150)
      ])

      setStatus(statusRes)
      setBranches(branchRes)
      setCommits(logRes)

      // 默认选择第一个修改的文件
      if (statusRes.unstaged.length > 0) {
        setSelectedFile(statusRes.unstaged[0])
      } else if (statusRes.staged.length > 0) {
        setSelectedFile(statusRes.staged[0])
      } else if (statusRes.untracked.length > 0) {
        setSelectedFile(statusRes.untracked[0])
      } else {
        setSelectedFile(null)
      }
    } catch (err: any) {
      toast.error("读取仓库信息失败", { description: cleanGitErrorMessage(err) })
    } finally {
      setLoading(false)
    }
  }, [repoPath])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 加载选定文件的 Diff
  useEffect(() => {
    if (!repoPath || !selectedFile || activeTab !== "status") {
      setDiffText("")
      return
    }
    const isStaged = status?.staged.some((f) => f.path === selectedFile.path)
    window.electronAPI.git
      .getDiff(repoPath, selectedFile.path, isStaged)
      .then((res) => setDiffText(res.diff))
      .catch(() => setDiffText(""))
  }, [repoPath, selectedFile, status, activeTab])

  // 加载选定 Commit 的详情
  useEffect(() => {
    if (!repoPath || activeTab !== "history" || commits.length === 0) return
    const commit = commits[selectedCommitIndex]
    if (!commit) return
    window.electronAPI.git
      .getCommitDetail(repoPath, commit.hash)
      .then((detail) => {
        setCommitDetail(detail)
        if (detail.files.length > 0) {
          window.electronAPI.git
            .getDiff(repoPath, detail.files[0].path, false, commit.hash)
            .then((res) => setDiffText(res.diff))
            .catch(() => setDiffText(""))
        } else {
          setDiffText("")
        }
      })
      .catch(() => setCommitDetail(null))
  }, [repoPath, activeTab, selectedCommitIndex, commits])

  // 拓扑图计算
  const topology = computeGitTopology(commits)

  // 操作函数
  const handleStageFile = async (path: string) => {
    try {
      await window.electronAPI.git.stage(repoPath, [path])
      await refresh()
    } catch (e: any) {
      toast.error("暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleUnstageFile = async (path: string) => {
    try {
      await window.electronAPI.git.unstage(repoPath, [path])
      await refresh()
    } catch (e: any) {
      toast.error("取消暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleStageAll = async () => {
    try {
      await window.electronAPI.git.stageAll(repoPath)
      await refresh()
    } catch (e: any) {
      toast.error("全部暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleUnstageAll = async () => {
    try {
      await window.electronAPI.git.unstageAll(repoPath)
      await refresh()
    } catch (e: any) {
      toast.error("取消暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleDiscard = async (file: GitFileStatus) => {
    if (!confirm(`确定放弃对文件 ${file.path} 的所有修改吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.discard(repoPath, [file.path], file.status === "?")
      await refresh()
      toast.success("已撤销修改")
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleDiscardStaged = async (file: GitFileStatus) => {
    if (!confirm(`确定放弃对已暂存文件 ${file.path} 的所有修改吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.unstage(repoPath, [file.path])
      await window.electronAPI.git.discard(repoPath, [file.path], false)
      await refresh()
      toast.success("已撤销修改")
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const getFullPath = (relPath: string) => {
    if (!repoPath) return relPath
    const cleanRepo = repoPath.replace(/[/\\]+$/, "")
    const cleanRel = relPath.replace(/^[/\\]+/, "")
    return `${cleanRepo}/${cleanRel}`
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已复制${label}`)
  }

  const handleRevealInFinder = async (filePath: string) => {
    if (!repoPath) return
    const fullPath = filePath.startsWith("/") ? filePath : getFullPath(filePath)
    try {
      await window.electronAPI.revealWorkspaceFile(repoPath, fullPath)
    } catch (e: any) {
      toast.error("在访达中显示失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleCheckoutCommit = async (hash: string) => {
    if (!confirm(`确定检出提交 ${hash.slice(0, 7)} 吗？这将处于分离头指针 (detached HEAD) 状态。`)) return
    try {
      await window.electronAPI.git.checkout(repoPath, hash)
      await refresh()
      toast.success(`已检出提交: ${hash.slice(0, 7)}`)
    } catch (e: any) {
      toast.error("检出失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleCreateTag = async (hash: string) => {
    const tag = window.prompt(`请输入要为此提交 (${hash.slice(0, 7)}) 创建的标签名:`)
    if (!tag || !tag.trim()) return
    try {
      await window.electronAPI.git.createTag(repoPath, tag.trim(), hash)
      await refresh()
      toast.success(`已创建标签: ${tag.trim()}`)
    } catch (e: any) {
      toast.error("创建标签失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleResetBranch = async (hash: string, mode: "soft" | "mixed" | "hard") => {
    const modeText =
      mode === "soft"
        ? "软重置 (Soft，保留所有修改)"
        : mode === "mixed"
          ? "混合重置 (Mixed，保留工作区，清空暂存区)"
          : "强行重置 (Hard，丢弃所有未提交修改)"
    if (mode === "hard") {
      if (
        !confirm(
          `警告：强行重置 (Hard Reset) 将丢弃所有未提交的修改并强制回退到 ${hash.slice(
            0,
            7
          )}，此操作不可撤销！确定继续吗？`
        )
      )
        return
    } else {
      if (!confirm(`确定将当前分支重置到提交 ${hash.slice(0, 7)} 吗？(${modeText})`)) return
    }
    try {
      await window.electronAPI.git.reset(repoPath, hash, mode)
      await refresh()
      toast.success(`已成功重置当前分支 (${mode})`)
    } catch (e: any) {
      toast.error("重置失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleUndoLastCommit = async (mode: "mixed" | "soft" = "mixed") => {
    if (!commits.length) {
      toast.error("当前分支没有可撤销的提交")
      return
    }
    const lastCommit = commits[0]
    const modeDesc =
      mode === "soft"
        ? "撤销提交并将修改保留在【暂存区】"
        : "撤销提交并将修改保留在【工作区 (未暂存)】"
    if (
      !confirm(
        `确定撤销最后一次提交吗？\n\n提交：${lastCommit.shortHash} ${lastCommit.message}\n操作：${modeDesc}，代码改动不会丢失。`
      )
    )
      return
    try {
      await window.electronAPI.git.reset(repoPath, "HEAD~1", mode)
      await refresh()
      toast.success(`已成功撤销提交 (${lastCommit.shortHash})`)
    } catch (e: any) {
      toast.error("撤销提交失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleRevertCommit = async (hash: string) => {
    if (!confirm(`确定要回滚提交 ${hash.slice(0, 7)} 吗？这将生成一个新的反向提交。`)) return
    try {
      await window.electronAPI.git.revert(repoPath, hash)
      await refresh()
      toast.success(`已回滚提交: ${hash.slice(0, 7)}`)
    } catch (e: any) {
      toast.error("回滚失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error("请输入提交说明 (Commit Message)")
      return
    }
    if ((status?.staged.length || 0) === 0 && !isAmend) {
      toast.error("没有已暂存的修改，请先暂存文件")
      return
    }
    try {
      await window.electronAPI.git.commit(repoPath, commitMessage.trim(), isAmend)
      setCommitMessage("")
      setIsAmend(false)
      await refresh()
      toast.success("提交成功")
    } catch (e: any) {
      toast.error("提交失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handleCheckoutBranch = async (branch: string) => {
    if (branch === branches.current) return
    try {
      await window.electronAPI.git.checkout(repoPath, branch)
      await refresh()
      toast.success(`已切换至分支: ${branch}`)
    } catch (e: any) {
      toast.error("切换分支失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const handlePull = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI.git.pull(repoPath)
      toast.success(res.output || "拉取成功")
      await refresh()
    } catch (e: any) {
      toast.error("拉取失败", { description: cleanGitErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  const handlePush = async () => {
    setLoading(true)
    try {
      const res = await window.electronAPI.git.push(repoPath)
      toast.success(res.output || "推送成功")
      await refresh()
    } catch (e: any) {
      toast.error("推送失败", { description: cleanGitErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = async () => {
    setLoading(true)
    try {
      await window.electronAPI.git.fetch(repoPath)
      toast.success("已成功抓取远端更新")
      await refresh()
    } catch (e: any) {
      toast.error("抓取失败", { description: cleanGitErrorMessage(e) })
    } finally {
      setLoading(false)
    }
  }

  const handleInitRepo = async () => {
    try {
      await window.electronAPI.git.init(repoPath)
      toast.success("已初始化 Git 仓库")
      await refresh()
    } catch (e: any) {
      toast.error("初始化失败", { description: cleanGitErrorMessage(e) })
    }
  }

  return (
    <Layout
      aside={
        <LayoutActivityBar
          activity="git"
          onActivityChange={handleActivityChange}
        />
      }
    >
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-white text-stone-800">
        {/* 1. 顶部操作工具栏 (SourceTree 经典 Toolbar) */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-stone-200 bg-stone-50/70 px-3">
          <div className="flex items-center gap-1">
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
              onClick={handlePull}
              disabled={loading || !isRepo}
            >
              <Download className="size-4 text-blue-600" />
              <span>拉取</span>
              {!!status?.behind && (
                <span className="rounded-full bg-blue-100 px-1 text-[10px] text-blue-700">{status.behind}</span>
              )}
            </button>

            {/* Push 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={handlePush}
              disabled={loading || !isRepo}
            >
              <Upload className="size-4 text-orange-600" />
              <span>推送</span>
              {!!status?.ahead && (
                <span className="rounded-full bg-orange-100 px-1 text-[10px] text-orange-700">{status.ahead}</span>
              )}
            </button>

            {/* Fetch 按钮 */}
            <button
              type="button"
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-stone-700 hover:bg-stone-200/70"
              onClick={handleFetch}
              disabled={loading || !isRepo}
            >
              <ArrowDownUp className="size-4 text-stone-600" />
              <span>抓取</span>
            </button>

            <div className="mx-1 h-4 w-px bg-stone-300" />

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

          {/* 仓库路径指示与切换 */}
          <div className="flex items-center gap-2 text-xs">
            <FolderGit2 className="size-4 text-stone-500" />
            {libraryProjects.length > 0 ? (
              <select
                value={libraryProjects.some((p) => p.path === repoPath) ? repoPath : ""}
                onChange={(e) => {
                  if (e.target.value === "__open_new__") {
                    void window.electronAPI.openDirectory().then((res) => {
                      if (res?.path) setRepoPath(res.path)
                    })
                  } else if (e.target.value) {
                    setRepoPath(e.target.value)
                  }
                }}
                className="h-7 max-w-[200px] truncate rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-700 focus:border-green-500 focus:outline-none"
              >
                {!libraryProjects.some((p) => p.path === repoPath) && repoPath && (
                  <option value={repoPath}>{repoPath.split(/[\\/]/).pop()} (当前)</option>
                )}
                {libraryProjects.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.name}
                  </option>
                ))}
                <option value="__open_new__">+ 打开本地其他目录...</option>
              </select>
            ) : (
              <span className="font-mono text-stone-600 truncate max-w-sm" title={repoPath}>
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
        </header>

      {/* 2. 主体区 (左右分栏，1号支持 Resizable 水平拖拽) */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 h-full w-full">
        {/* 1号: 左侧边栏导航 (SourceTree 风格) */}
        <ResizablePanel
          id="git-sidebar-nav"
          defaultSize="18%"
          minSize="10%"
          maxSize="35%"
          className="bg-stone-50/50 flex flex-col overflow-y-auto p-2 text-xs select-none min-h-0"
        >
          {/* 工作区区段 */}
          <div className="mb-4">
            <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">工作空间</div>
            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                activeTab === "status" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"
              }`}
              onClick={() => setActiveTab("status")}
            >
              <span className="flex items-center gap-2">
                <FileText className="size-3.5 text-stone-500" />
                文件状态
              </span>
              {!!(status?.unstaged.length || status?.staged.length || status?.untracked.length) && (
                <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
                  {(status?.unstaged.length || 0) + (status?.staged.length || 0) + (status?.untracked.length || 0)}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                activeTab === "history" ? "bg-stone-200/80 font-medium text-stone-900" : "text-stone-600 hover:bg-stone-100"
              }`}
              onClick={() => setActiveTab("history")}
            >
              <span className="flex items-center gap-2">
                <Clock className="size-3.5 text-stone-500" />
                历史记录
              </span>
              <span className="text-[10px] text-stone-400">{commits.length}</span>
            </button>
          </div>

          {/* 分支区段 */}
          <div className="mb-4">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-stone-400">
              <span>分支 (BRANCHES)</span>
              <button
                type="button"
                title="新建分支"
                className="hover:text-stone-700"
                onClick={() => {
                  setBranchStartPoint(undefined)
                  setCreateBranchOpen(true)
                }}
              >
                <Plus className="size-3.5" />
              </button>
            </div>
            {branches.local.map((b) => {
              const isCurrent = b === branches.current
              return (
                <div
                  key={b}
                  onDoubleClick={() => handleCheckoutBranch(b)}
                  onClick={() => handleCheckoutBranch(b)}
                  className={`flex cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 transition-colors ${
                    isCurrent ? "bg-green-50 font-semibold text-green-800" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <GitBranch className={`size-3.5 ${isCurrent ? "text-green-600" : "text-stone-400"}`} />
                    <span className="truncate">{b}</span>
                  </span>
                  {isCurrent && <CheckCircle2 className="size-3.5 text-green-600 shrink-0" />}
                </div>
              )
            })}
          </div>

          {/* 远端分支 */}
          {branches.remote.length > 0 && (
            <div className="mb-4">
              <div className="px-2 py-1 text-[11px] font-semibold text-stone-400">远程 (REMOTES)</div>
              {branches.remote.map((r) => (
                <div
                  key={r}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1 text-stone-500 hover:bg-stone-100 truncate text-[11px]"
                  title={r}
                >
                  <Layers className="size-3 shrink-0 text-stone-400" />
                  <span className="truncate">{r}</span>
                </div>
              ))}
            </div>
          )}
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
              <Button size="sm" onClick={handleInitRepo} className="bg-green-600 text-white hover:bg-green-700">
                初始化为 Git 仓库
              </Button>
            </div>
          ) : activeTab === "status" ? (
            /* 视图 1: 文件状态视图 (1号占60%，4号占40%，3号使用Resizable拖拽调整) */
            <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 h-full w-full">
              {/* 1号: 文件列表区 (Staged + Unstaged) - 宽度为 1号+4号 之和的 60% */}
              <ResizablePanel
                id="git-file-list"
                defaultSize="60%"
                minSize="20%"
                maxSize="85%"
                className="flex flex-col min-h-0 min-w-0 bg-stone-50/30"
              >
                {/* 2号: 垂直可调整面板组 (已暂存 / 未暂存，支持 Resizable 拖拽) */}
                <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0 h-full w-full">
                  {/* 已暂存区 */}
                  <ResizablePanel
                    id="git-staged-panel"
                    defaultSize="50%"
                    minSize="15%"
                    maxSize="85%"
                    className="flex flex-col min-h-0 min-w-0"
                  >
                    <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold text-stone-700">
                    <span className="flex items-center gap-1.5">
                      <span>已暂存文件 (Staged)</span>
                      <span className="rounded-full bg-green-100 px-1.5 text-[10px] text-green-700">
                        {status?.staged.length || 0}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-normal text-stone-500 hover:text-stone-800"
                      onClick={handleUnstageAll}
                    >
                      全部取消
                    </button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 p-1">
                    <div className="space-y-0.5">
                      {status?.staged.map((file) => (
                        <ContextMenu key={file.path}>
                          <ContextMenuTrigger asChild>
                            <div
                              onClick={() => setSelectedFile(file)}
                              onContextMenu={() => setSelectedFile(file)}
                              className={`group flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer ${
                                selectedFile?.path === file.path ? "bg-stone-200 font-medium" : "hover:bg-stone-100"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <FileText className="size-3.5 shrink-0 text-stone-400 group-hover:text-stone-600" />
                                <span className="w-3.5 text-center font-bold text-green-600">{file.status}</span>
                                <span className="truncate" title={file.path}>
                                  {file.path}
                                </span>
                              </span>
                              <button
                                type="button"
                                title="取消暂存"
                                className="opacity-0 group-hover:opacity-100 rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-amber-700 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void handleUnstageFile(file.path)
                                }}
                              >
                                <Minus className="size-3.5" />
                              </button>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-52">
                            <ContextMenuItem onSelect={() => void handleUnstageFile(file.path)}>
                              <Minus className="size-3.5 text-amber-600" />
                              <span>取消暂存文件</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void handleUnstageAll()}>
                              <Minus className="size-3.5 text-stone-500" />
                              <span>全部取消暂存</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => setSelectedFile(file)}>
                              <FileText className="size-3.5 text-stone-500" />
                              <span>查看文件差异</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void handleRevealInFinder(file.path)}>
                              <FolderOpen className="size-3.5 text-stone-500" />
                              <span>在访达中显示</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => copyToClipboard(file.path, "相对路径")}>
                              <Copy className="size-3.5 text-stone-500" />
                              <span>复制相对路径</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => copyToClipboard(getFullPath(file.path), "绝对路径")}>
                              <Copy className="size-3.5 text-stone-500" />
                              <span>复制绝对路径</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => void handleDiscardStaged(file)}
                            >
                              <Trash2 className="size-3.5 text-red-500" />
                              <span>放弃更改…</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                      {!status?.staged.length && (
                        <p className="p-3 text-center text-xs text-stone-400">暂无已暂存文件</p>
                      )}
                    </div>
                  </ScrollArea>
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
                  <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-stone-100/70 px-3 py-1.5 text-xs font-semibold text-stone-700">
                    <span className="flex items-center gap-1.5">
                      <span>未暂存更改 (Unstaged)</span>
                      <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-700">
                        {(status?.unstaged.length || 0) + (status?.untracked.length || 0)}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-[11px] font-normal text-stone-500 hover:text-stone-800"
                      onClick={handleStageAll}
                    >
                      全部暂存
                    </button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0 p-1">
                    <div className="space-y-0.5">
                      {[...(status?.unstaged || []), ...(status?.untracked || [])].map((file) => (
                        <ContextMenu key={file.path}>
                          <ContextMenuTrigger asChild>
                            <div
                              onClick={() => setSelectedFile(file)}
                              onContextMenu={() => setSelectedFile(file)}
                              className={`group flex items-center justify-between rounded px-2 py-1 text-xs cursor-pointer ${
                                selectedFile?.path === file.path ? "bg-stone-200 font-medium" : "hover:bg-stone-100"
                              }`}
                            >
                              <span className="flex items-center gap-1.5 truncate">
                                <FileText className="size-3.5 shrink-0 text-stone-400 group-hover:text-stone-600" />
                                <span
                                  className={`w-3.5 text-center font-bold ${
                                    file.status === "?" ? "text-blue-500" : "text-amber-600"
                                  }`}
                                >
                                  {file.status}
                                </span>
                                <span className="truncate" title={file.path}>
                                  {file.path}
                                </span>
                              </span>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                                <button
                                  type="button"
                                  title="暂存此文件"
                                  className="rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-green-700 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleStageFile(file.path)
                                  }}
                                >
                                  <Plus className="size-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="放弃修改"
                                  className="rounded p-1 text-stone-400 hover:bg-stone-200/80 hover:text-red-600 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    void handleDiscard(file)
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-52">
                            <ContextMenuItem onSelect={() => void handleStageFile(file.path)}>
                              <Plus className="size-3.5 text-green-600" />
                              <span>暂存此文件</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void handleStageAll()}>
                              <Plus className="size-3.5 text-stone-500" />
                              <span>全部暂存</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              className="text-red-600 focus:text-red-600"
                              onSelect={() => void handleDiscard(file)}
                            >
                              <Trash2 className="size-3.5 text-red-500" />
                              <span>放弃更改…</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => setSelectedFile(file)}>
                              <FileText className="size-3.5 text-stone-500" />
                              <span>查看文件差异</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => void handleRevealInFinder(file.path)}>
                              <FolderOpen className="size-3.5 text-stone-500" />
                              <span>在访达中显示</span>
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem onSelect={() => copyToClipboard(file.path, "相对路径")}>
                              <Copy className="size-3.5 text-stone-500" />
                              <span>复制相对路径</span>
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => copyToClipboard(getFullPath(file.path), "绝对路径")}>
                              <Copy className="size-3.5 text-stone-500" />
                              <span>复制绝对路径</span>
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                      {!status?.unstaged.length && !status?.untracked.length && (
                        <p className="p-3 text-center text-xs text-stone-400">工作区干净，无任何变更</p>
                      )}
                    </div>
                  </ScrollArea>
                </ResizablePanel>
                </ResizablePanelGroup>

                {/* 底部提交输入栏 */}
                <div className="border-t border-stone-200 p-2.5 bg-white shrink-0">
                  <textarea
                    rows={3}
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="输入提交信息 (Commit message)…"
                    className="w-full resize-none rounded border border-stone-200 p-2 text-xs outline-none focus:border-green-600"
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleCommit()
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-[11px] text-stone-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAmend}
                          onChange={(e) => setIsAmend(e.target.checked)}
                          className="rounded border-stone-300"
                        />
                        <span>修改上次提交</span>
                      </label>
                      {commits.length > 0 && (
                        <button
                          type="button"
                          className="flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 hover:underline"
                          onClick={() => void handleUndoLastCommit("mixed")}
                          title="撤销最后一次提交并将修改保留在工作区 (git reset HEAD~1)"
                        >
                          <Undo2 className="size-3" />
                          <span>撤销上次提交</span>
                        </button>
                      )}
                    </div>
                    <Button
                      size="sm"
                      onClick={handleCommit}
                      className="bg-green-600 text-white hover:bg-green-700 h-7 text-xs px-3"
                    >
                      提交到 {branches.current || "HEAD"}
                    </Button>
                  </div>
                </div>
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
            <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0 h-full w-full">
              {/* 1号: 提交拓扑图与提交列表 (带 ScrollArea 滚动条) */}
              <ResizablePanel
                id="git-history-graph"
                defaultSize="65%"
                minSize="20%"
                maxSize="85%"
                className="flex min-h-0 flex-col"
              >
                <ScrollArea className="flex-1 min-h-0">
                  <div className="flex min-w-[700px]">
                    {/* SVG 拓扑轨道列 */}
                    <div className="shrink-0">
                      <GitGraphSvg
                        nodes={topology.nodes}
                        maxColumns={topology.maxColumns}
                        selectedIndex={selectedCommitIndex}
                        onSelectIndex={(idx) => setSelectedCommitIndex(idx)}
                      />
                    </div>

                    {/* 提交列表信息 */}
                    <div className="flex-1">
                      {commits.map((c, idx) => {
                        const isSelected = idx === selectedCommitIndex
                        return (
                          <ContextMenu key={c.hash}>
                            <ContextMenuTrigger asChild>
                              <div
                                style={{ height: 32 }}
                                onClick={() => setSelectedCommitIndex(idx)}
                                onContextMenu={() => setSelectedCommitIndex(idx)}
                                className={`flex items-center gap-3 px-2 text-xs cursor-pointer border-b border-stone-100 ${
                                  isSelected ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-stone-50 text-stone-700"
                                }`}
                              >
                                <span className="font-mono text-[11px] text-stone-400">{c.shortHash}</span>
                                <span className="truncate flex-1" title={c.message}>
                                  {c.refs.map((r) => (
                                    <span
                                      key={r}
                                      className="mr-1.5 rounded bg-blue-100 px-1 py-0.5 text-[10px] font-semibold text-blue-700"
                                    >
                                      {r}
                                    </span>
                                  ))}
                                  {c.message}
                                </span>
                                <span className="w-24 truncate text-stone-500 text-[11px]">{c.author}</span>
                                <span className="w-32 text-stone-400 text-[11px] text-right">{c.date}</span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-56">
                              <ContextMenuItem onSelect={() => void handleCheckoutCommit(c.hash)}>
                                <GitCommit className="size-3.5 text-stone-500" />
                                <span>检出此提交 ({c.shortHash})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() => {
                                  setBranchStartPoint(c.hash)
                                  setCreateBranchOpen(true)
                                }}
                              >
                                <GitBranch className="size-3.5 text-indigo-500" />
                                <span>在此处创建分支…</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => void handleCreateTag(c.hash)}>
                                <Tag className="size-3.5 text-amber-500" />
                                <span>在此处创建标签…</span>
                              </ContextMenuItem>

                              <ContextMenuSeparator />

                              {idx === 0 && (
                                <>
                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger className="text-amber-700 focus:text-amber-800 font-medium">
                                      <Undo2 className="size-3.5 text-amber-600" />
                                      <span>撤销最后一次提交…</span>
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-64">
                                      <ContextMenuItem onSelect={() => void handleUndoLastCommit("mixed")}>
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-medium text-stone-800">保留修改在工作区 (推荐)</span>
                                          <span className="text-[10px] text-stone-400">git reset HEAD~1 (退回未暂存区)</span>
                                        </div>
                                      </ContextMenuItem>
                                      <ContextMenuItem onSelect={() => void handleUndoLastCommit("soft")}>
                                        <div className="flex flex-col gap-0.5">
                                          <span className="font-medium text-stone-800">保留修改在暂存区</span>
                                          <span className="text-[10px] text-stone-400">git reset --soft HEAD~1</span>
                                        </div>
                                      </ContextMenuItem>
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>
                                  <ContextMenuSeparator />
                                </>
                              )}

                              <ContextMenuSub>
                                <ContextMenuSubTrigger>
                                  <RotateCcw className="size-3.5 text-orange-500" />
                                  <span>重置当前分支到此处</span>
                                </ContextMenuSubTrigger>
                                <ContextMenuSubContent className="w-64">
                                  <ContextMenuItem onSelect={() => void handleResetBranch(c.hash, "mixed")}>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-stone-800">混合重置 (--mixed, 默认)</span>
                                      <span className="text-[10px] text-stone-400">回退到此，修改保留在工作区</span>
                                    </div>
                                  </ContextMenuItem>
                                  <ContextMenuItem onSelect={() => void handleResetBranch(c.hash, "soft")}>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-stone-800">软重置 (--soft, 保留暂存)</span>
                                      <span className="text-[10px] text-stone-400">回退到此，修改保留在暂存区</span>
                                    </div>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    className="text-red-600 focus:text-red-600"
                                    onSelect={() => void handleResetBranch(c.hash, "hard")}
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-medium text-red-600">强行重置 (--hard, 丢弃修改)</span>
                                      <span className="text-[10px] text-red-400">⚠️ 丢弃所有改动，强制对齐该提交</span>
                                    </div>
                                  </ContextMenuItem>
                                </ContextMenuSubContent>
                              </ContextMenuSub>

                              <ContextMenuItem onSelect={() => void handleRevertCommit(c.hash)}>
                                <Undo2 className="size-3.5 text-stone-500" />
                                <span>回滚此提交 (Revert)</span>
                              </ContextMenuItem>

                              <ContextMenuSeparator />

                              <ContextMenuItem onSelect={() => copyToClipboard(c.hash, "提交 SHA-1")}>
                                <Copy className="size-3.5 text-stone-500" />
                                <span>复制提交 SHA-1</span>
                              </ContextMenuItem>
                              <ContextMenuItem onSelect={() => copyToClipboard(c.message, "提交信息")}>
                                <Copy className="size-3.5 text-stone-500" />
                                <span>复制提交信息</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        )
                      })}
                    </div>
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
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
                <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0 h-full w-full">
                  {/* 左侧：提交详情与修改文件列表 */}
                  <ResizablePanel
                    id="git-history-commit-files"
                    defaultSize="35%"
                    minSize="20%"
                    maxSize="70%"
                    className="flex min-h-0 min-w-0 flex-col bg-white"
                  >
                    <ScrollArea className="flex-1 min-h-0 p-3 text-xs">
                      {commitDetail ? (
                        <div>
                          <div className="font-semibold text-stone-800 mb-1">{commitDetail.message}</div>
                          <div className="text-stone-400 text-[11px] mb-2">
                            {commitDetail.author} &lt;{commitDetail.email}&gt; • {commitDetail.date}
                          </div>
                          <div className="text-[11px] font-mono text-stone-400 mb-3">
                            Commit: {commitDetail.hash}
                          </div>

                          <div className="text-[11px] font-semibold text-stone-500 mb-1">
                            修改的文件 ({commitDetail.files.length})
                          </div>
                          <div className="space-y-1">
                            {commitDetail.files.map((f) => (
                              <ContextMenu key={f.path}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    className="group flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-stone-100 cursor-pointer text-xs"
                                    onClick={() => {
                                      window.electronAPI.git
                                        .getDiff(repoPath, f.path, false, commitDetail.hash)
                                        .then((res) => setDiffText(res.diff))
                                    }}
                                    onContextMenu={() => {
                                      window.electronAPI.git
                                        .getDiff(repoPath, f.path, false, commitDetail.hash)
                                        .then((res) => setDiffText(res.diff))
                                    }}
                                  >
                                    <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                                      {/* 2号: 文件图标 */}
                                      <FileText className="size-3.5 shrink-0 text-stone-400 group-hover:text-stone-600" />
                                      {/* 3号: 溢出显示省略号 */}
                                      <span className="truncate min-w-0 flex-1 text-stone-700" title={f.path}>
                                        {f.path}
                                      </span>
                                    </div>
                                    <span className="shrink-0 text-[10px] font-mono font-medium text-green-600">
                                      +{f.additions}
                                    </span>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-52">
                                  <ContextMenuItem
                                    onSelect={() => {
                                      window.electronAPI.git
                                        .getDiff(repoPath, f.path, false, commitDetail.hash)
                                        .then((res) => setDiffText(res.diff))
                                    }}
                                  >
                                    <FileText className="size-3.5 text-stone-500" />
                                    <span>查看文件差异</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem onSelect={() => void handleRevealInFinder(f.path)}>
                                    <FolderOpen className="size-3.5 text-stone-500" />
                                    <span>在访达中显示</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onSelect={() => copyToClipboard(f.path, "相对路径")}>
                                    <Copy className="size-3.5 text-stone-500" />
                                    <span>复制相对路径</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem onSelect={() => copyToClipboard(getFullPath(f.path), "绝对路径")}>
                                    <Copy className="size-3.5 text-stone-500" />
                                    <span>复制绝对路径</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-stone-400">选择一次提交查看详细内容</p>
                      )}
                    </ScrollArea>
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
                    <DiffViewer diffText={diffText} filePath="Commit 差异对比" />
                  </ResizablePanel>
                </ResizablePanelGroup>
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* 弹窗：新建分支 */}
      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={(open) => {
          setCreateBranchOpen(open)
          if (!open) setBranchStartPoint(undefined)
        }}
        currentBranch={branches.current}
        branches={branches.local}
        startPoint={branchStartPoint}
        onCreate={async (name, startPoint, checkout) => {
          try {
            await window.electronAPI.git.createBranch(repoPath, name, startPoint, checkout)
            toast.success(`成功创建分支: ${name}`)
            await refresh()
          } catch (e: any) {
            toast.error("创建分支失败", { description: cleanGitErrorMessage(e) })
          }
        }}
      />

      {/* 弹窗：合并分支 */}
      <MergeBranchDialog
        open={mergeBranchOpen}
        onOpenChange={setMergeBranchOpen}
        currentBranch={branches.current}
        branches={branches.local}
        onMerge={async (branch) => {
          try {
            const res = await window.electronAPI.git.merge(repoPath, branch)
            if (res.success) {
              toast.success("合并成功")
            } else {
              toast.warning(`合并完成，请检查冲突：${res.output}`)
            }
            await refresh()
          } catch (e: any) {
            toast.error("合并失败", { description: cleanGitErrorMessage(e) })
          }
        }}
      />
      </div>
    </Layout>
  )
}
