import type { GitFileStatus } from "@vessel/type"
import { useEffect } from "react"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"

/** 文件列表多选交互与快捷键全选 */
export function useGitFileSelection(repo: GitRepositoryState) {
  const { activeTab, status, setSelectedFile, selectedStagedPaths, setSelectedStagedPaths, selectedUnstagedPaths, setSelectedUnstagedPaths, lastStagedClickedIndex, setLastStagedClickedIndex, lastUnstagedClickedIndex, setLastUnstagedClickedIndex, activeFileSection, setActiveFileSection } = repo

  // 快捷键多选交互 (Click, Cmd/Ctrl+Click, Shift+Click)

  /** Handles staged item click events. */
  const handleStagedItemClick = (e: React.MouseEvent, file: GitFileStatus, idx: number) => {
    setActiveFileSection("staged")
    const isMeta = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey
    const allStaged = status?.staged || []

    if (isShift && lastStagedClickedIndex >= 0 && lastStagedClickedIndex < allStaged.length) {
      const start = Math.min(lastStagedClickedIndex, idx)
      const end = Math.max(lastStagedClickedIndex, idx)
      const rangePaths = allStaged.slice(start, end + 1).map((f) => f.path)
      setSelectedStagedPaths(rangePaths)
      setSelectedUnstagedPaths([])
      setSelectedFile(file)
    } else if (isMeta) {
      setSelectedStagedPaths((prev) => {
        const exists = prev.includes(file.path)
        return exists ? prev.filter((p) => p !== file.path) : [...prev, file.path]
      })
      setSelectedUnstagedPaths([])
      setLastStagedClickedIndex(idx)
      setSelectedFile(file)
    } else {
      setSelectedStagedPaths([file.path])
      setSelectedUnstagedPaths([])
      setLastStagedClickedIndex(idx)
      setSelectedFile(file)
    }
  }

  /** Handles staged context menu events. */
  const handleStagedContextMenu = (file: GitFileStatus, idx: number) => {
    setActiveFileSection("staged")
    setSelectedFile(file)
    if (!selectedStagedPaths.includes(file.path)) {
      setSelectedStagedPaths([file.path])
      setSelectedUnstagedPaths([])
      setLastStagedClickedIndex(idx)
    }
  }

  /** Handles unstaged item click events. */
  const handleUnstagedItemClick = (e: React.MouseEvent, file: GitFileStatus, idx: number) => {
    setActiveFileSection("unstaged")
    const isMeta = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey
    const allUnstaged = [...(status?.unstaged || []), ...(status?.untracked || [])]

    if (isShift && lastUnstagedClickedIndex >= 0 && lastUnstagedClickedIndex < allUnstaged.length) {
      const start = Math.min(lastUnstagedClickedIndex, idx)
      const end = Math.max(lastUnstagedClickedIndex, idx)
      const rangePaths = allUnstaged.slice(start, end + 1).map((f) => f.path)
      setSelectedUnstagedPaths(rangePaths)
      setSelectedStagedPaths([])
      setSelectedFile(file)
    } else if (isMeta) {
      setSelectedUnstagedPaths((prev) => {
        const exists = prev.includes(file.path)
        return exists ? prev.filter((p) => p !== file.path) : [...prev, file.path]
      })
      setSelectedStagedPaths([])
      setLastUnstagedClickedIndex(idx)
      setSelectedFile(file)
    } else {
      setSelectedUnstagedPaths([file.path])
      setSelectedStagedPaths([])
      setLastUnstagedClickedIndex(idx)
      setSelectedFile(file)
    }
  }

  /** Handles unstaged context menu events. */
  const handleUnstagedContextMenu = (file: GitFileStatus, idx: number) => {
    setActiveFileSection("unstaged")
    setSelectedFile(file)
    if (!selectedUnstagedPaths.includes(file.path)) {
      setSelectedUnstagedPaths([file.path])
      setSelectedStagedPaths([])
      setLastUnstagedClickedIndex(idx)
    }
  }

  // 快捷键全选 (Cmd+A / Ctrl+A)
  useEffect(() => {
    /** Handles key down events. */
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "a") return
      const target = e.target as HTMLElement | null
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
        return
      }

      if (activeTab === "status") {
        e.preventDefault()
        const allUnstaged = [...(status?.unstaged || []), ...(status?.untracked || [])]
        if (activeFileSection === "staged" && (status?.staged.length || 0) > 0) {
          setSelectedStagedPaths(status!.staged.map((f) => f.path))
          setSelectedUnstagedPaths([])
        } else if (allUnstaged.length > 0) {
          setSelectedUnstagedPaths(allUnstaged.map((f) => f.path))
          setSelectedStagedPaths([])
          setActiveFileSection("unstaged")
        } else if ((status?.staged.length || 0) > 0) {
          setSelectedStagedPaths(status!.staged.map((f) => f.path))
          setSelectedUnstagedPaths([])
          setActiveFileSection("staged")
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [activeTab, activeFileSection, status])

  return { handleStagedItemClick, handleStagedContextMenu, handleUnstagedItemClick, handleUnstagedContextMenu }
}
