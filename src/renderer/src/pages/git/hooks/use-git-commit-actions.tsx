import { useState } from "react"
import { TextWithArrows } from "@/components/ui/text-with-arrows"
import { toast } from "@/components/ui/sonner"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"

/** 提交、分支与远程操作 */
export function useGitCommitActions(repo: GitRepositoryState) {
  const { repoPath, setLoading, setRemoteOperation, remotePending, status, branches, commits, commitMessage, setCommitMessageReset, isAmend, setIsAmend, refresh } = repo

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
    if (!confirm(`确定撤销最后一次提交吗？\n\n提交：${lastCommit.shortHash} ${lastCommit.message}\n操作：${modeDesc}，代码改动不会丢失。`)) return
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
      await window.electronAPI.openExternal(url)
    } catch (e: any) {
      toast.error("打开远程仓库失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles commit events. */
  const handleCommit = async () => {
    const message = commitMessage.current
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
      if (commitMessage.current === message) {
        commitMessage.current = ""
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
      else toast.warning(`合并完成，请检查冲突：${res.output}`)
      await refresh()
    } catch (e: any) {
      toast.error("合并失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles pull events. */
  const handlePull = async (remote?: string, branch?: string) => {
    if (remotePending.current) return
    remotePending.current = true
    setRemoteOperation("pull")
    setLoading(true)
    try {
      const res = await window.electronAPI.git.pull(repoPath, remote, branch)
      toast.success(<TextWithArrows text={res.output || "拉取成功"} />)
      await refresh()
    } catch (e: any) {
      toast.error("拉取失败", { description: cleanGitErrorMessage(e) })
    } finally {
      remotePending.current = false
      setRemoteOperation(null)
      setLoading(false)
    }
  }

  /** Handles push events. */
  const handlePush = async (remote?: string, branch?: string) => {
    if (remotePending.current) return
    remotePending.current = true
    setRemoteOperation("push")
    setLoading(true)
    try {
      const res = await window.electronAPI.git.push(repoPath, remote, branch)
      toast.success(<TextWithArrows text={res.output || "推送成功"} />)
      await refresh()
    } catch (e: any) {
      toast.error("推送失败", { description: cleanGitErrorMessage(e) })
    } finally {
      remotePending.current = false
      setRemoteOperation(null)
      setLoading(false)
    }
  }

  /** Handles fetch events. */
  const handleFetch = async (remote?: string) => {
    if (remotePending.current) return
    remotePending.current = true
    setRemoteOperation("fetch")
    setLoading(true)
    try {
      await window.electronAPI.git.fetch(repoPath, remote)
      toast.success(remote ? `已抓取远程 ${remote}` : "已成功抓取远端更新")
      await refresh()
    } catch (e: any) {
      toast.error("抓取失败", { description: cleanGitErrorMessage(e) })
    } finally {
      remotePending.current = false
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

  return { tagTarget, setTagTarget, handleCheckoutCommit, handleCreateTag, handleResetBranch, handleUndoLastCommit, handleRevertCommit, handleOpenRemoteCommit, handleCommit, handleCheckoutBranch, handleDeleteBranch, handleMergeBranch, handlePull, handlePush, handleFetch, handleInitRepo }
}
