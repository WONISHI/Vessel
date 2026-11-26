import { matchesGitFilePath } from "../file-filter"
import type { GitFileStatus } from "@vessel/type"
import { useEffect } from "react"
import type { GitRepositoryState } from "@/pages/git/hooks/use-git-repository"

/** DOM order reflects tree sorting, filtering and collapsed folders. */
function visibleFiles(event: React.MouseEvent | React.KeyboardEvent, fallback: GitFileStatus[]) {
  const list = event.currentTarget?.closest("[data-git-changes-list]")
  if (!list) return fallback
  const byPath = new Map(fallback.map(file => [file.path, file]))
  return [...list.querySelectorAll<HTMLElement>("[data-git-change-path]")]
    .map(row => byPath.get(row.dataset.gitChangePath!)).filter((file): file is GitFileStatus => !!file)
}

/** 文件列表多选交互与快捷键全选 */
export function useGitFileSelection(repo: GitRepositoryState, query: string | { staged: string; unstaged: string; conflicts?: string } = "") {
  const { activeTab, status, setSelectedFile, selectedStagedPaths, setSelectedStagedPaths, selectedUnstagedPaths, setSelectedUnstagedPaths, lastStagedClickedIndex, setLastStagedClickedIndex, lastUnstagedClickedIndex, setLastUnstagedClickedIndex, activeFileSection, setActiveFileSection, selectedConflictPaths, setSelectedConflictPaths, lastConflictClickedIndex, setLastConflictClickedIndex } = repo

  const stagedQuery = typeof query === "string" ? query : query.staged
  const unstagedQuery = typeof query === "string" ? query : query.unstaged

  const conflictQuery = typeof query === "string" ? query : query.conflicts ?? ""

  // 快捷键多选交互 (Click, Cmd/Ctrl+Click, Shift+Click)

  /** Handles staged item click events. */
  const handleStagedItemClick = (e: React.MouseEvent | React.KeyboardEvent, file: GitFileStatus, idx: number) => {
    setSelectedConflictPaths([])
    setActiveFileSection("staged")
    const isMeta = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey
    const sourceStaged = status?.staged || []
    const allStaged = visibleFiles(e, sourceStaged.filter(item => matchesGitFilePath(item.path, stagedQuery)))
    const anchorIndex = allStaged.findIndex(item => item.path === sourceStaged[lastStagedClickedIndex]?.path)
    const clickedIndex = allStaged.findIndex(item => item.path === file.path)

    if (isShift && anchorIndex >= 0 && clickedIndex >= 0) {
      const start = Math.min(anchorIndex, clickedIndex)
      const end = Math.max(anchorIndex, clickedIndex)
      const rangePaths = allStaged.slice(start, end + 1).map((f) => f.path)
      setSelectedStagedPaths(previous => isMeta ? [...new Set([...previous, ...rangePaths])] : rangePaths)
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
    setSelectedConflictPaths([])
    setActiveFileSection("staged")
    setSelectedFile(file)
    if (!selectedStagedPaths.includes(file.path)) {
      setSelectedStagedPaths([file.path])
      setSelectedUnstagedPaths([])
      setLastStagedClickedIndex(idx)
    }
  }

  /** Handles unstaged item click events. */
  const handleUnstagedItemClick = (e: React.MouseEvent | React.KeyboardEvent, file: GitFileStatus, idx: number) => {
    setSelectedConflictPaths([])
    setActiveFileSection("unstaged")
    const isMeta = e.metaKey || e.ctrlKey
    const isShift = e.shiftKey
    const sourceUnstaged = [...(status?.unstaged || []), ...(status?.untracked || [])]
    const allUnstaged = visibleFiles(e, sourceUnstaged.filter(item => matchesGitFilePath(item.path, unstagedQuery)))
    const anchorIndex = allUnstaged.findIndex(item => item.path === sourceUnstaged[lastUnstagedClickedIndex]?.path)
    const clickedIndex = allUnstaged.findIndex(item => item.path === file.path)

    if (isShift && anchorIndex >= 0 && clickedIndex >= 0) {
      const start = Math.min(anchorIndex, clickedIndex)
      const end = Math.max(anchorIndex, clickedIndex)
      const rangePaths = allUnstaged.slice(start, end + 1).map((f) => f.path)
      setSelectedUnstagedPaths(previous => isMeta ? [...new Set([...previous, ...rangePaths])] : rangePaths)
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
    setSelectedConflictPaths([])
    setActiveFileSection("unstaged")
    setSelectedFile(file)
    if (!selectedUnstagedPaths.includes(file.path)) {
      setSelectedUnstagedPaths([file.path])
      setSelectedStagedPaths([])
      setLastUnstagedClickedIndex(idx)
    }
  }

  const handleFileKeyDown = (event: React.KeyboardEvent<HTMLElement>, staged: boolean) => {
    if ((event.target as HTMLElement).closest("button,input,textarea,[contenteditable=true]")) return
    const source = staged ? status?.staged || [] : [...(status?.unstaged || []), ...(status?.untracked || [])]
    const files = visibleFiles(event, source)
    const current = files.findIndex(file => file.path === event.currentTarget.dataset.gitChangePath)
    if (current < 0) return
    const command = event.metaKey || event.ctrlKey
    const select = staged ? handleStagedItemClick : handleUnstagedItemClick
    if (command && event.key.toLowerCase() === "a") {
      event.preventDefault(); event.stopPropagation()
      setActiveFileSection(staged ? "staged" : "unstaged")
      setSelectedConflictPaths([])
      if (staged) { setSelectedStagedPaths(files.map(file => file.path)); setSelectedUnstagedPaths([]) }
      else { setSelectedUnstagedPaths(files.map(file => file.path)); setSelectedStagedPaths([]) }
      return
    }
    let next = current
    if (event.key === "ArrowDown") next = Math.min(current + 1, files.length - 1)
    else if (event.key === "ArrowUp") next = Math.max(0, current - 1)
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = files.length - 1
    else if (event.key !== " " && event.key !== "Escape") return
    if (event.altKey) return
    event.preventDefault(); event.stopPropagation()
    const row = [...(event.currentTarget.closest('[data-git-changes-list]')?.querySelectorAll<HTMLElement>('[data-git-change-path]') || [])].find(row => row.dataset.gitChangePath === files[next].path)
    row?.focus({ preventScroll: true })
    row?.scrollIntoView?.({ block: "nearest" })
    if (!command || event.shiftKey || event.key === " ") {
      select({ currentTarget: row || event.currentTarget, shiftKey: event.key === "Escape" ? false : event.shiftKey, metaKey: event.key === " " || command && event.shiftKey, ctrlKey: false } as React.KeyboardEvent<HTMLElement>, files[next], source.findIndex(file => file.path === files[next].path))
    }
  }
  const handleStagedItemKeyDown = (event: React.KeyboardEvent<HTMLElement>) => handleFileKeyDown(event, true)
  const handleUnstagedItemKeyDown = (event: React.KeyboardEvent<HTMLElement>) => handleFileKeyDown(event, false)

  const handleConflictItemClick = (event: React.MouseEvent, file: GitFileStatus, index: number) => {
    setActiveFileSection("conflicts")
    setSelectedStagedPaths([])
    setSelectedUnstagedPaths([])
    setSelectedFile(file)
    const source = status?.conflicts || []
    const files = visibleFiles(event, source.filter(item => matchesGitFilePath(item.path, conflictQuery)))
    const anchor = files.findIndex(item => item.path === source[lastConflictClickedIndex]?.path)
    const clicked = files.findIndex(item => item.path === file.path)
    if (event.shiftKey && anchor >= 0 && clicked >= 0) {
      setSelectedConflictPaths(files.slice(Math.min(clicked, anchor), Math.max(clicked, anchor) + 1).map(entry => entry.path))
    } else {
      setSelectedConflictPaths((previous) => event.metaKey || event.ctrlKey ? previous.includes(file.path) ? previous.filter((path) => path !== file.path) : [...previous, file.path] : [file.path])
      setLastConflictClickedIndex(index)
    }
  }
  const handleConflictChecked = (file: GitFileStatus, index: number, checked: boolean) => {
    setActiveFileSection("conflicts")
    setSelectedStagedPaths([])
    setSelectedUnstagedPaths([])
    setSelectedFile(file)
    setLastConflictClickedIndex(index)
    setSelectedConflictPaths((previous) => checked ? [...new Set([...previous, file.path])] : previous.filter((path) => path !== file.path))
  }
  const handleConflictContextMenu = (file: GitFileStatus, index: number) => {
    if (!selectedConflictPaths.includes(file.path)) {
      setSelectedConflictPaths([file.path])
      setSelectedStagedPaths([])
      setSelectedUnstagedPaths([])
      setLastConflictClickedIndex(index)
      setActiveFileSection("conflicts")
      setSelectedFile(file)
    }
    else { setActiveFileSection("conflicts"); setSelectedFile(file) }
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
        const allStaged = (status?.staged || []).filter(item => matchesGitFilePath(item.path, stagedQuery))
        const allUnstaged = [...(status?.unstaged || []), ...(status?.untracked || [])].filter(item => matchesGitFilePath(item.path, unstagedQuery))
        if (activeFileSection === "conflicts" && status?.conflicts.length) {
          setSelectedConflictPaths(status.conflicts.filter(file => matchesGitFilePath(file.path, conflictQuery)).map(file => file.path))
          setSelectedStagedPaths([])
          setSelectedUnstagedPaths([])
        } else if (activeFileSection === "staged" && allStaged.length > 0) {
          setSelectedConflictPaths([])
          setSelectedStagedPaths(allStaged.map((f) => f.path))
          setSelectedUnstagedPaths([])
        } else if (allUnstaged.length > 0) {
          setSelectedConflictPaths([])
          setSelectedUnstagedPaths(allUnstaged.map((f) => f.path))
          setSelectedStagedPaths([])
          setActiveFileSection("unstaged")
        } else if (allStaged.length > 0) {
          setSelectedConflictPaths([])
          setSelectedStagedPaths(allStaged.map((f) => f.path))
          setSelectedUnstagedPaths([])
          setActiveFileSection("staged")
        } else if (status?.conflicts.length) {
          setSelectedConflictPaths(status.conflicts.filter(file => matchesGitFilePath(file.path, conflictQuery)).map(file => file.path))
          setSelectedStagedPaths([])
          setSelectedUnstagedPaths([])
          setActiveFileSection("conflicts")
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [stagedQuery, unstagedQuery, conflictQuery, activeTab, activeFileSection, status])

  return { handleStagedItemKeyDown, handleUnstagedItemKeyDown, handleConflictItemClick, handleConflictChecked, handleConflictContextMenu, handleStagedItemClick, handleStagedContextMenu, handleUnstagedItemClick, handleUnstagedContextMenu }
}
