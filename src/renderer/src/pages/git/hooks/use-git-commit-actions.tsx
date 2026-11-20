import { openInAppBrowser } from "@/lib/app-browser"
import { useRouter } from "@vessel/react-router"
import { useRef, useState } from "react"
import { GitOutputDetails } from "@/pages/git/components/git-output-details"
import { toast } from "@/components/ui/sonner"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"
import type { GitFetchSelection, GitPullSelection, GitPushSelection } from "@vessel/type/git"

/** 提交、分支与远程操作 */
export function useGitCommitActions(repo: GitRepositoryState, requestConfirmation: (description: string, tone?: "danger" | "primary") => Promise<boolean>) {
  const router = useRouter()
  const { repoPath, setLoading, setRemoteOperation, remotePending: remotePendingRef, status, branches, commits, commitMessage: commitMessageRef, setCommitMessageReset, isAmend, setIsAmend, refresh } = repo

  /** Handles checkout commit events. */
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

  const [tagTarget, setTagTarget] = useState<{ hash: string; repoPath: string } | null>(null)
  const handleCreateTag = (hash: string) => setTagTarget({ hash, repoPath })

  /** Handles reset branch events. */
  const handleResetBranch = async (hash: string, mode: "soft" | "mixed" | "hard") => {
    const modeText = mode === "soft" ? "软重置 (Soft，保留所有修改)" : mode === "mixed" ? "混合重置 (Mixed，保留工作区，清空暂存区)" : "强行重置 (Hard，丢弃所有未提交修改)"
    if (mode === "hard") {
      if (!confirm(`警告：强行重置 (Hard Reset) 将丢弃所有未提交的修改并强制回退到 ${hash.slice(0, 7)}，此操作不可撤销！确定继续吗？`)) return
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

  /** Handles undo last commit events. */
  const handleUndoLastCommit = async (mode: "mixed" | "soft" = "mixed") => {
    if (!commits.length) {
      toast.error("当前分支没有可撤销的提交")
      return
    }
    const lastCommit = commits[0]
    const modeDesc = mode === "soft" ? "撤销提交并将修改保留在【暂存区】" : "撤销提交并将修改保留在【工作区 (未暂存)】"
    if (!await requestConfirmation(`确定撤销最后一次提交吗？\n\n提交：${lastCommit.shortHash} ${lastCommit.message}\n操作：${modeDesc}，代码改动不会丢失。`, "primary")) return
    try {
      await window.electronAPI.git.reset(repoPath, "HEAD~1", mode)
      await refresh()
      toast.success(`已成功撤销提交 (${lastCommit.shortHash})`)
    } catch (e: any) {
      toast.error("撤销提交失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles revert commit events. */
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

  /** 打开远程仓库查看当前提交记录 */
  const handleOpenRemoteCommit = async (hash: string) => {
    if (!repoPath) return
    try {
      const url = await window.electronAPI.git.getRemoteCommitUrl(repoPath, hash)
      if (!url) {
        toast.error("未找到有效的远程仓库地址，请先关联远程仓库 (Remote)")
        return
      }
      openInAppBrowser(url, (path) => router.push(path))
    } catch (e: any) {
      toast.error("打开远程仓库失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles commit events. */
  const handleCommit = async () => {
    const message = commitMessageRef.current
    if (!message.trim()) {
      toast.error("请输入提交说明 (Commit Message)")
      return
    }
    if ((status?.staged.length || 0) === 0 && !isAmend) {
      toast.error("没有已暂存的修改，请先暂存文件")
      return
    }
    try {
      await window.electronAPI.git.commit(repoPath, message.trim(), isAmend)
      if (commitMessageRef.current === message) {
        commitMessageRef.current = ""
        setCommitMessageReset((version) => version + 1)
      }
      setIsAmend(false)
      await refresh()
      toast.success("提交成功")
    } catch (e: any) {
      toast.error("提交失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles checkout branch events. */
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

  /** Deletes a local branch (not the current checkout). */
  const handleDeleteBranch = async (branch: string, force = false) => {
    if (!branch || branch === branches.current) {
      toast.error("不能删除当前检出的分支")
      return
    }
    try {
      await window.electronAPI.git.deleteBranch(repoPath, branch, force)
      await refresh()
      toast.success(`已删除分支: ${branch}`)
    } catch (e: any) {
      toast.error("删除分支失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Merges a branch into the current checkout. */
  const handleMergeBranch = async (branch: string) => {
    if (!branch || branch === branches.current) return
    try {
      const res = await window.electronAPI.git.merge(repoPath, branch)
      if (res.success) toast.success(`已合并分支: ${branch}`)
      else toast.warning("合并完成，请检查冲突", { description: <GitOutputDetails output={res.output} /> })
      await refresh()
    } catch (e: any) {
      toast.error("合并失败", { description: cleanGitErrorMessage(e) })
    }
  }

  const [pullRequest, setPullRequest] = useState<{ repoPath: string; remote?: string; branch?: string } | null>(null)
  const handlePull = (remote?: string, branch?: string) => {
    if (!remotePendingRef.current) setPullRequest({ repoPath, remote, branch })
  }
  const submitPull = async (selection: GitPullSelection) => {
    if (remotePendingRef.current) throw new Error("已有远程操作正在进行，请稍后重试")
    remotePendingRef.current = true
    setRemoteOperation("pull")
    setLoading(true)
    try {
      const res = await window.electronAPI.git.pull(repoPath, selection.remote, selection.branch, selection.options)
      toast.success("拉取成功", { description: res.output ? <GitOutputDetails output={res.output} /> : undefined })
      await refresh()
    } finally {
      remotePendingRef.current = false
      setRemoteOperation(null)
      setLoading(false)
    }
  }

  /** Handles push events. */
  const [pushRequest, setPushRequest] = useState<{ repoPath: string; remote?: string; branch?: string } | null>(null)
  const activePush = useRef<{ repoPath: string; id: string } | null>(null)
  const cancelPush = async () => {
    const request = activePush.current
    return request ? window.electronAPI.git.cancelPush(request.repoPath, request.id) : false
  }
  const handlePush = (remote?: string, branch?: string) => {
    if (!remotePendingRef.current) setPushRequest({ repoPath, remote, branch })
  }
  const submitPush = async (selection: GitPushSelection) => {
    if (remotePendingRef.current) throw new Error("已有远程操作正在进行，请稍后重试")
    const operation = { repoPath, id: crypto.randomUUID() }
    activePush.current = operation
    remotePendingRef.current = true
    setRemoteOperation("push")
    setLoading(true)
    try {
      const res = await window.electronAPI.git.pushSelection(repoPath, selection, operation.id)
      toast.success("推送成功", { description: res.output ? <GitOutputDetails output={res.output} /> : undefined })
      await refresh()
    } catch (error) {
      if (cleanGitErrorMessage(error) === "推送已取消") toast.info("推送已取消")
      throw error
    } finally {
      if (activePush.current === operation) activePush.current = null
      remotePendingRef.current = false
      setRemoteOperation(null)
      setLoading(false)
    }
  }

  /** Handles fetch events. */
  const [fetchRequest, setFetchRequest] = useState<{ repoPath: string; remote?: string } | null>(null)
  const handleFetch = (remote?: string) => {
    if (!remotePendingRef.current) setFetchRequest({ repoPath, remote })
  }
  const submitFetch = async (selection: GitFetchSelection) => {
    if (remotePendingRef.current) throw new Error("已有远程操作正在进行，请稍后重试")
    remotePendingRef.current = true
    setRemoteOperation("fetch")
    setLoading(true)
    try {
      await window.electronAPI.git.fetch(repoPath, selection.remote, { all: selection.all, prune: selection.prune, tags: selection.tags })
      toast.success(selection.all ? "已成功抓取所有远端更新" : `已抓取远程 ${selection.remote}`)
      await refresh()
    } finally {
      remotePendingRef.current = false
      setRemoteOperation(null)
      setLoading(false)
    }
  }

  /** Handles init repo events. */
  const handleInitRepo = async () => {
    try {
      await window.electronAPI.git.init(repoPath)
      toast.success("已初始化 Git 仓库")
      await refresh()
    } catch (e: any) {
      toast.error("初始化失败", { description: cleanGitErrorMessage(e) })
    }
  }

  return { fetchRequest, setFetchRequest, submitFetch, pullRequest, setPullRequest, submitPull, pushRequest, setPushRequest, submitPush, cancelPush, tagTarget, setTagTarget, handleCheckoutCommit, handleCreateTag, handleResetBranch, handleUndoLastCommit, handleRevertCommit, handleOpenRemoteCommit, handleCommit, handleCheckoutBranch, handleDeleteBranch, handleMergeBranch, handlePull, handlePush, handleFetch, handleInitRepo }
}
