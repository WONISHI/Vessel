import { type GitRemoteOperation } from "@/pages/git/components/operation-loading"
import { toast } from "@/components/ui/sonner"
import { computeGitTopology } from "@/pages/git/components/git-graph"
import type { GitCommitDetail, GitCommitItem, GitFileStatus, GitStatusResult } from "@vessel/type"
import { useCallback, useEffect, useRef, useState } from "react"
import { cleanGitErrorMessage, findCommitIndexForBranch, getInitialRepoPath, persistGitRepoPath } from "@/pages/git/utils"

/** 仓库数据状态、刷新逻辑与派生计数 */
export function useGitRepository() {
  const [repositorySettingsOpen, setRepositorySettingsOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [repoPath, setRepoPath] = useState<string>(getInitialRepoPath)
  const [libraryProjects, setLibraryProjects] = useState<{ name: string; path: string }[]>([])

  // 记住 Git 页选中的仓库，切到其他路由再回来仍显示同一项
  useEffect(() => {
    persistGitRepoPath(repoPath)
  }, [repoPath])

  useEffect(() => {
    /** Updates projects. */
    const updateProjects = () => {
      window.electronAPI
        .getAppState<Array<{ name: string; path: string }>>("project-library")
        .then((saved) => {
          if (Array.isArray(saved)) setLibraryProjects(saved.filter((p) => p.path && p.name))
        })
        .catch(() => {})
    }
    updateProjects()

    /** Handles resource changed events. */
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
  const [activeTab, setActiveTab] = useState<"status" | "history" | "search">("status")
  const [loading, setLoading] = useState(false)
  const [remoteOperation, setRemoteOperation] = useState<GitRemoteOperation | null>(null)
  const remotePending = useRef(false)
  const [status, setStatus] = useState<GitStatusResult | null>(null)
  const [branches, setBranches] = useState<{ local: string[]; remote: string[]; current: string }>({
    local: [],
    remote: [],
    current: ""
  })
  const [commits, setCommits] = useState<GitCommitItem[]>([])
  const [unpushedHashes, setUnpushedHashes] = useState<Set<string>>(new Set())
  const [commitTotal, setCommitTotal] = useState(0)
  // Badges count only the current branch, independent of the history list scope.
  const [branchCommitTotal, setBranchCommitTotal] = useState(0)
  const [historyLoading, setHistoryLoading] = useState(false)
  const historyVersion = useRef(0)
  const historyPending = useRef<number | null>(null)
  const [historyFailed, setHistoryFailed] = useState(false)
  const [selectedCommitIndex, setSelectedCommitIndex] = useState(0)
  /** Nonzero bump asks the history list to scroll the selected tip into view. */
  const [historyFocusNonce, setHistoryFocusNonce] = useState(0)
  /** Branch leaf click waits for history (and optional scope refresh) before selecting tip. */
  const pendingBranchTipRef = useRef<string | null>(null)
  const branchTipLoadAttemptsRef = useRef(0)
  const [branchTipRequestId, setBranchTipRequestId] = useState(0)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)
  const [historyScope, setHistoryScope] = useState<"all" | "current">("all")

  // 选中的文件与 Diff
  const [selectedFile, setSelectedFile] = useState<GitFileStatus | null>(null)
  const [diffText, setDiffText] = useState("")

  // 多选与选区状态
  const [selectedStagedPaths, setSelectedStagedPaths] = useState<string[]>([])
  const [selectedUnstagedPaths, setSelectedUnstagedPaths] = useState<string[]>([])
  const [lastStagedClickedIndex, setLastStagedClickedIndex] = useState(-1)
  const [lastUnstagedClickedIndex, setLastUnstagedClickedIndex] = useState(-1)
  const [activeFileSection, setActiveFileSection] = useState<"staged" | "unstaged">("unstaged")
  const [stashes, setStashes] = useState<{ index: number; name: string; date: string }[]>([])

  // Commit 表单
  const commitMessage = useRef("")
  const [commitMessageReset, setCommitMessageReset] = useState(0)
  useEffect(() => {
    if (!repoPath) return
    let cancelled = false
    window.electronAPI.git.getRepositorySettings(repoPath).then((settings) => {
      if (!cancelled && !commitMessage.current && settings.templateMode !== "none" && settings.template) {
        commitMessage.current = settings.template
        setCommitMessageReset((value) => value + 1)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [repoPath, repositorySettingsOpen])
  const [isAmend, setIsAmend] = useState(false)

  // 弹窗状态
  const [createBranchOpen, setCreateBranchOpen] = useState(false)
  const [branchStartPoint, setBranchStartPoint] = useState<string | undefined>(undefined)
  const [branchNamePrefix, setBranchNamePrefix] = useState("")
  const [mergeBranchOpen, setMergeBranchOpen] = useState(false)

  // 刷新当前仓库数据

  /** Refreshes refresh. */
  const refresh = useCallback(async (silent = false) => {
    if (!repoPath) {
      setIsRepo(false)
      return
    }
    const version = ++historyVersion.current
    historyPending.current = null
    setHistoryFailed(false)
    setHistoryLoading(false)
    if (!silent) setLoading(true)
    try {
      const git = window.electronAPI.git
      const valid = await git.isRepo(repoPath)
      if (version !== historyVersion.current) return
      setIsRepo(valid)
      if (!valid) {
        setLoading(false)
        return
      }

      const isAll = historyScope === "all"
      const [statusRes, branchRes, logRes, stashRes, totalRes, unpushedRes, branchTotalRes] = await Promise.all([
        git.getStatus(repoPath),
        git.getBranches(repoPath),
        git.getLog(repoPath, 150, 0, isAll),
        git.getStashes(repoPath).catch(() => []),
        git.getLogCount(repoPath, isAll),
        git.getUnpushedCommits(repoPath).catch(() => []),
        // 当前分支范围下与 totalRes 相同，避免重复计数
        isAll ? git.getLogCount(repoPath, false).catch(() => 0) : null
      ])

      if (version !== historyVersion.current) return
      setCommitTotal(totalRes)
      setBranchCommitTotal(branchTotalRes ?? totalRes)
      setStatus(statusRes)
      setBranches(branchRes)
      setCommits(logRes)
      setStashes(stashRes || [])
      setUnpushedHashes(new Set(unpushedRes || []))

      // 保持当前的多选列表中依然有效的文件
      setSelectedStagedPaths((prev) => prev.filter((p) => statusRes.staged.some((f) => f.path === p)))
      const allUnstaged = [...statusRes.unstaged, ...statusRes.untracked]
      setSelectedUnstagedPaths((prev) => prev.filter((p) => allUnstaged.some((f) => f.path === p)))

      // 选定文件：如果当前选中的还在，则保持；否则选第一个可用变更
      setSelectedFile((prev) => {
        if (prev) {
          const stillStaged = statusRes.staged.find((f) => f.path === prev.path)
          if (stillStaged) return stillStaged
          const stillUnstaged = allUnstaged.find((f) => f.path === prev.path)
          if (stillUnstaged) return stillUnstaged
        }
        if (statusRes.unstaged.length > 0) return statusRes.unstaged[0]
        if (statusRes.staged.length > 0) return statusRes.staged[0]
        if (statusRes.untracked.length > 0) return statusRes.untracked[0]
        return null
      })
    } catch (err: any) {
      if (version !== historyVersion.current) return
      toast.error("读取仓库信息失败", { description: cleanGitErrorMessage(err) })
    } finally {
      if (version === historyVersion.current) setLoading(false)
    }
  }, [repoPath, historyScope])

  /** Loads the next history page while rejecting responses from an older refresh. */
  const loadMoreHistory = async () => {
    if (historyPending.current !== null || historyLoading || loading || commits.length >= commitTotal) return
    const version = historyVersion.current
    historyPending.current = version
    setHistoryFailed(false)
    setHistoryLoading(true)
    try {
      const isAll = historyScope === "all"
      const next = await window.electronAPI.git.getLog(repoPath, 150, commits.length, isAll)
      if (version !== historyVersion.current) return
      setCommits((current) => [...new Map([...current, ...next].map((commit) => [commit.hash, commit])).values()])
      if (!next.length) setCommitTotal(commits.length)
    } catch (error) {
      if (version === historyVersion.current) {
        setHistoryFailed(true)
        toast.error("加载历史记录失败", { description: cleanGitErrorMessage(error) })
      }
    } finally {
      if (version === historyVersion.current) { historyPending.current = null; setHistoryLoading(false) }
    }
  }

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 合并连续文件事件，避免保存文件时重复扫描仓库。
  useEffect(() => {
    if (!repoPath) return
    let disposed = false
    let watchId: string | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let running = false
    let pending = false
    const reload = async () => {
      if (disposed) return
      if (running) {
        pending = true
        return
      }
      running = true
      await refresh(true)
      running = false
      if (pending && !disposed) {
        pending = false
        schedule()
      }
    }
    const schedule = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { void reload() }, 500)
    }
    const off = window.electronAPI.onFilesChanged((root) => {
      if (root === repoPath) schedule()
    })
    void window.electronAPI.watchStart(repoPath).then((id) => {
      if (disposed) void window.electronAPI.watchStop(id).catch(console.error)
      else {
        watchId = id
        schedule()
      }
    }).catch(console.error)
    window.addEventListener("focus", schedule)
    return () => {
      disposed = true
      clearTimeout(timer)
      off()
      window.removeEventListener("focus", schedule)
      if (watchId) void window.electronAPI.watchStop(watchId).catch(console.error)
      historyVersion.current++
    }
  }, [repoPath, refresh])

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

  /** Selects a branch tip in the history graph (sidebar leaf click; not checkout). */
  const navigateToBranchTip = useCallback(
    (branch: string) => {
      if (!branch) return
      pendingBranchTipRef.current = branch
      branchTipLoadAttemptsRef.current = 0
      setBranchTipRequestId((value) => value + 1)
      setActiveTab("history")
      if (historyScope !== "all") {
        setHistoryScope("all")
        return
      }
      const idx = findCommitIndexForBranch(commits, branch)
      if (idx >= 0) {
        pendingBranchTipRef.current = null
        setSelectedCommitIndex(idx)
        setHistoryFocusNonce((value) => value + 1)
      }
    },
    [commits, historyScope]
  )

  // After switching to history / all-branches, keep loading until the tip row is found.
  useEffect(() => {
    const branch = pendingBranchTipRef.current
    if (!branch || activeTab !== "history" || loading || historyScope !== "all") return

    const idx = findCommitIndexForBranch(commits, branch)
    if (idx >= 0) {
      pendingBranchTipRef.current = null
      setSelectedCommitIndex(idx)
      setHistoryFocusNonce((value) => value + 1)
      return
    }

    if (commits.length === 0) return
    if (commits.length >= commitTotal || historyLoading || historyPending.current !== null) return
    if (branchTipLoadAttemptsRef.current >= 20) {
      pendingBranchTipRef.current = null
      toast.error("未在历史记录中找到该分支的尖端提交", { description: branch })
      return
    }
    branchTipLoadAttemptsRef.current += 1
    void loadMoreHistory()
  }, [activeTab, loading, historyScope, commits, commitTotal, historyLoading, branchTipRequestId])

  // 拓扑图计算
  const topology = computeGitTopology(commits)

  // 待推送 (未推送到远程仓库的本地提交数) 与 待拉取 (远程仓库更新数)
  const aheadCount = Math.max(status?.ahead || 0, unpushedHashes.size)
  const branchSyncedTotal = Math.max(0, branchCommitTotal - aheadCount)
  const behindCount = status?.behind || 0

  return { repositorySettingsOpen, setRepositorySettingsOpen, terminalOpen, setTerminalOpen, repoPath, setRepoPath, libraryProjects, setLibraryProjects, isRepo, setIsRepo, activeTab, setActiveTab, loading, setLoading, remoteOperation, setRemoteOperation, remotePending, status, setStatus, branches, setBranches, commits, setCommits, unpushedHashes, setUnpushedHashes, commitTotal, setCommitTotal, branchCommitTotal, setBranchCommitTotal, historyLoading, setHistoryLoading, historyVersion, historyPending, historyFailed, setHistoryFailed, selectedCommitIndex, setSelectedCommitIndex, historyFocusNonce, navigateToBranchTip, commitDetail, setCommitDetail, historyScope, setHistoryScope, selectedFile, setSelectedFile, diffText, setDiffText, selectedStagedPaths, setSelectedStagedPaths, selectedUnstagedPaths, setSelectedUnstagedPaths, lastStagedClickedIndex, setLastStagedClickedIndex, lastUnstagedClickedIndex, setLastUnstagedClickedIndex, activeFileSection, setActiveFileSection, stashes, setStashes, commitMessage, commitMessageReset, setCommitMessageReset, isAmend, setIsAmend, createBranchOpen, setCreateBranchOpen, branchStartPoint, setBranchStartPoint, branchNamePrefix, setBranchNamePrefix, mergeBranchOpen, setMergeBranchOpen, refresh, loadMoreHistory, topology, aheadCount, branchSyncedTotal, behindCount }
}

export type GitRepositoryState = ReturnType<typeof useGitRepository>
