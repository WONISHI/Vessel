import type { GitFileStatus, GitStatusResult } from '@vessel/type'
export type GitFileSection = 'staged' | 'unstaged' | 'conflicts'
export interface GitFileSelectionState {
 selectedFile: GitFileStatus | null
 selectedStagedPaths: string[]; selectedUnstagedPaths: string[]; selectedConflictPaths: string[]
 activeFileSection: GitFileSection
 lastStagedClickedIndex: number; lastUnstagedClickedIndex: number; lastConflictClickedIndex: number
}
const snapshots = new Map<string, GitFileSelectionState>()
const listeners = new Map<string, Set<() => void>>()
export function getGitFileSelection(repo: string): GitFileSelectionState {
 let value = snapshots.get(repo)
 if (!value) {
  value = { selectedFile: null, selectedStagedPaths: [], selectedUnstagedPaths: [], selectedConflictPaths: [], activeFileSection: 'unstaged', lastStagedClickedIndex: -1, lastUnstagedClickedIndex: -1, lastConflictClickedIndex: -1 }
  snapshots.set(repo, value)
 }
 return value
}
export function subscribeGitFileSelection(repo: string, listener: () => void) {
 const list = listeners.get(repo) || new Set<() => void>()
 list.add(listener); listeners.set(repo, list)
 return () => { list.delete(listener); if (!list.size) listeners.delete(repo) }
}
export function updateGitFileSelection(repo: string, update: (previous: GitFileSelectionState) => GitFileSelectionState) {
 const previous = getGitFileSelection(repo), next = update(previous)
 if (next === previous) return
 snapshots.set(repo, next)
 listeners.get(repo)?.forEach((listener) => listener())
}

/** Reconcile cached selection against fresh Git status, preserving its staged/working-tree context. */
export function reconcileGitFileSelection(repo: string, status: GitStatusResult) {
 updateGitFileSelection(repo, (previous) => {
  const files = { staged: status.staged, unstaged: [...status.unstaged, ...status.untracked], conflicts: status.conflicts }
  const byPath = { staged: new Map(files.staged.map((file) => [file.path, file])), unstaged: new Map(files.unstaged.map((file) => [file.path, file])), conflicts: new Map(files.conflicts.map((file) => [file.path, file])) }
  const selected = {
   staged: previous.selectedStagedPaths.filter((path) => byPath.staged.has(path)),
   unstaged: previous.selectedUnstagedPaths.filter((path) => byPath.unstaged.has(path)),
   conflicts: previous.selectedConflictPaths.filter((path) => byPath.conflicts.has(path))
  }
  const order: GitFileSection[] = [previous.activeFileSection, ...(['conflicts', 'unstaged', 'staged'] as const).filter((section) => section !== previous.activeFileSection)]
  let section = order.find((section) => byPath[section].has(previous.selectedFile?.path || ''))
  let file = section ? byPath[section].get(previous.selectedFile!.path)! : null
  if (!file) {
   section = order.find((section) => selected[section].length > 0)
   if (section) file = byPath[section].get(selected[section][0])!
  }
  if (!file) {
   const fallback = ([['conflicts', status.conflicts[0]], ['unstaged', status.unstaged[0]], ['staged', status.staged[0]], ['unstaged', status.untracked[0]]] as const).find(([, file]) => file)
   section = fallback?.[0]
   file = fallback?.[1] || null
  }
  section ||= previous.activeFileSection
  const moved = file?.path !== previous.selectedFile?.path || section !== previous.activeFileSection
  if (file && (!previous.selectedFile || moved) && !selected[section].includes(file.path)) selected[section] = [...selected[section], file.path]
  const next: GitFileSelectionState = {
   selectedFile: file, selectedStagedPaths: selected.staged, selectedUnstagedPaths: selected.unstaged, selectedConflictPaths: selected.conflicts,
   activeFileSection: section,
   lastStagedClickedIndex: section === 'staged' && file ? files.staged.findIndex((entry) => entry.path === file.path) : -1,
   lastUnstagedClickedIndex: section === 'unstaged' && file ? files.unstaged.findIndex((entry) => entry.path === file.path) : -1,
   lastConflictClickedIndex: section === 'conflicts' && file ? files.conflicts.findIndex((entry) => entry.path === file.path) : -1
  }
  // Keep snapshots stable when background refreshes report the same selection.
  return JSON.stringify(previous) === JSON.stringify(next) ? previous : next
 })
}
