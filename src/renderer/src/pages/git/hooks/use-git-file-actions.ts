import { toast } from "@/components/ui/sonner"
import { useEffect, useRef, useState } from "react"
import type { GitFileStatus } from "@vessel/type"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"

export type StashRequest = { paths?: string[]; defaultMessage: string }

/** 文件暂存 / 放弃 / 贮藏与路径工具 */
export function useGitFileActions(repo: GitRepositoryState) {
  const { repoPath, status, branches, refresh } = repo
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const pendingConfirmation = useRef<((accepted: boolean) => void) | null>(null)
  const settleConfirmation = (accepted: boolean) => {
    const resolve = pendingConfirmation.current
    pendingConfirmation.current = null
    setConfirmation(null)
    resolve?.(accepted)
  }
  const requestConfirmation = (description: string) => new Promise<boolean>((resolve) => {
    pendingConfirmation.current?.(false)
    pendingConfirmation.current = resolve
    setConfirmation(description)
  })
  useEffect(() => () => {
    pendingConfirmation.current?.(false)
    pendingConfirmation.current = null
  }, [repoPath])


  // 操作函数

  /** Handles stage file events. */
  const handleStageFile = async (path: string) => {
    try {
      await window.electronAPI.git.stage(repoPath, [path])
      await refresh()
    } catch (e: any) {
      toast.error("暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles unstage file events. */
  const handleUnstageFile = async (path: string) => {
    try {
      await window.electronAPI.git.unstage(repoPath, [path])
      await refresh()
    } catch (e: any) {
      toast.error("取消暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles stage all events. */
  const handleStageAll = async () => {
    try {
      await window.electronAPI.git.stageAll(repoPath)
      await refresh()
    } catch (e: any) {
      toast.error("全部暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles unstage all events. */
  const handleUnstageAll = async () => {
    try {
      await window.electronAPI.git.unstageAll(repoPath)
      await refresh()
    } catch (e: any) {
      toast.error("取消暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles discard events. */
  const handleDiscard = async (file: GitFileStatus) => {
    if (!await requestConfirmation(`确定放弃对文件 ${file.path} 的所有修改吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.discard(repoPath, [file.path], file.status === "?")
      await refresh()
      toast.success("已撤销修改")
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles discard staged events. */
  const handleDiscardStaged = async (file: GitFileStatus) => {
    if (!await requestConfirmation(`确定放弃对已暂存文件 ${file.path} 的所有修改吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.unstage(repoPath, [file.path])
      await window.electronAPI.git.discard(repoPath, [file.path], false)
      await refresh()
      toast.success("已撤销修改")
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  // 批量操作

  /** Handles stage multiple events. */
  const handleStageMultiple = async (paths: string[]) => {
    if (!repoPath || paths.length === 0) return
    try {
      await window.electronAPI.git.stage(repoPath, paths)
      await refresh()
    } catch (e: any) {
      toast.error("批量暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles unstage multiple events. */
  const handleUnstageMultiple = async (paths: string[]) => {
    if (!repoPath || paths.length === 0) return
    try {
      await window.electronAPI.git.unstage(repoPath, paths)
      await refresh()
    } catch (e: any) {
      toast.error("批量取消暂存失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles discard multiple events. */
  const handleDiscardMultiple = async (paths: string[]) => {
    if (!repoPath || paths.length === 0) return
    if (!await requestConfirmation(`确定放弃选中的 ${paths.length} 个文件的所有修改吗？此操作无法撤销。`)) return
    try {
      const unstagedList = [...(status?.unstaged || []), ...(status?.untracked || [])]
      const untrackedPaths = paths.filter((p) => unstagedList.find((f) => f.path === p)?.status === "?")
      const trackedPaths = paths.filter((p) => !untrackedPaths.includes(p))
      if (untrackedPaths.length > 0) {
        await window.electronAPI.git.discard(repoPath, untrackedPaths, true)
      }
      if (trackedPaths.length > 0) {
        await window.electronAPI.git.discard(repoPath, trackedPaths, false)
      }
      await refresh()
      toast.success(`已撤销 ${paths.length} 个文件的修改`)
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles discard staged multiple events. */
  const handleDiscardStagedMultiple = async (paths: string[]) => {
    if (!repoPath || paths.length === 0) return
    if (!await requestConfirmation(`确定放弃选中的 ${paths.length} 个已暂存文件的所有修改吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.unstage(repoPath, paths)
      await window.electronAPI.git.discard(repoPath, paths, false)
      await refresh()
      toast.success(`已撤销 ${paths.length} 个已暂存文件的修改`)
    } catch (e: any) {
      toast.error("放弃修改失败", { description: cleanGitErrorMessage(e) })
    }
  }

  // 贮藏功能 (支持单文件、多文件、全工作区)

  const [stashRequest, setStashRequest] = useState<StashRequest | null>(null)

  /** Opens the stash dialog for the given files. */
  const handleStashFiles = (paths: string[]) => {
    if (!repoPath || paths.length === 0) return
    setStashRequest({ paths, defaultMessage: paths.length === 1 ? `贮藏修改: ${paths[0]}` : `贮藏选中的 ${paths.length} 个文件修改` })
  }

  /** Opens the stash dialog for the whole working tree. */
  const handleStashAll = () => {
    if (!repoPath) return
    const totalChanges = (status?.staged.length || 0) + (status?.unstaged.length || 0) + (status?.untracked.length || 0)
    if (totalChanges === 0) {
      toast.info("当前工作区干净，无未提交的修改")
      return
    }
    setStashRequest({ defaultMessage: `WIP 在 ${branches.current || "HEAD"} (${totalChanges} 个文件)` })
  }

  /** Runs the stash described by the open request; errors propagate to the dialog. */
  const submitStash = async (message: string, keepIndex: boolean) => {
    if (!repoPath || !stashRequest) return
    const { paths, defaultMessage } = stashRequest
    await window.electronAPI.git.stashSave(repoPath, message.trim() || defaultMessage, paths, { keepIndex })
    setStashRequest(null)
    await refresh()
    toast.success(paths ? `已成功贮藏 ${paths.length} 个文件的修改` : "已成功贮藏工作区修改")
  }

  /** Handles stash pop events. */
  const handleStashPop = async (index = 0) => {
    if (!repoPath) return
    try {
      await window.electronAPI.git.stashPop(repoPath, index)
      await refresh()
      toast.success("已恢复贮藏内容")
    } catch (e: any) {
      toast.error("弹出贮藏失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Handles stash drop events. */
  const handleStashDrop = async (index = 0) => {
    if (!repoPath) return
    if (!await requestConfirmation(`确定删除贮藏 stash@{${index}} 吗？此操作无法撤销。`)) return
    try {
      await window.electronAPI.git.stashDrop(repoPath, index)
      await refresh()
      toast.success("已删除贮藏")
    } catch (e: any) {
      toast.error("删除贮藏失败", { description: cleanGitErrorMessage(e) })
    }
  }

  /** Returns full path. */
  const getFullPath = (relPath: string) => {
    if (!repoPath) return relPath
    const cleanRepo = repoPath.replace(/[/\\]+$/, "")
    const cleanRel = relPath.replace(/^[/\\]+/, "")
    return `${cleanRepo}/${cleanRel}`
  }

  /** Copies to clipboard. */
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`已复制${label}`)
  }

  /** Handles reveal in finder events. */
  const handleRevealInFinder = async (filePath: string) => {
    if (!repoPath) return
    const fullPath = filePath.startsWith("/") ? filePath : getFullPath(filePath)
    try {
      await window.electronAPI.revealWorkspaceFile(repoPath, fullPath)
    } catch (e: any) {
      toast.error("在访达中显示失败", { description: cleanGitErrorMessage(e) })
    }
  }

  return { confirmation, settleConfirmation, handleStageFile, handleUnstageFile, handleStageAll, handleUnstageAll, handleDiscard, handleDiscardStaged, handleStageMultiple, handleUnstageMultiple, handleDiscardMultiple, handleDiscardStagedMultiple, handleStashFiles, handleStashAll, stashRequest, setStashRequest, submitStash, handleStashPop, handleStashDrop, getFullPath, copyToClipboard, handleRevealInFinder }
}
