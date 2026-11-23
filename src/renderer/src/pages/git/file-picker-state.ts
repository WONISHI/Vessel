import { useSyncExternalStore } from "react"
import type { GitFileStatus, GitStatusResult } from "@vessel/type"

export const GIT_FILE_PICKER_REQUEST = "vessel:request-git-files"
export type GitPickerEntry = { id: string; section: "staged" | "unstaged" | "conflicts"; file: GitFileStatus }
export type GitPickerData = { repoPath: string; activeId?: string; entries: GitPickerEntry[]; select: (entry: GitPickerEntry) => void }
export type GitPickerRequest = (data: GitPickerData) => void

/** Keep index/worktree versions distinct, and include only changed files. */
export function gitPickerEntries(status: GitStatusResult | null | undefined): GitPickerEntry[] {
  if (!status) return []
  const staged = status.staged.map(file => ({ id: `staged:${file.path}`, section: "staged" as const, file }))
  const conflicts = new Set(status.conflicts.map(file => file.path))
  const worktree = [...new Map([...status.conflicts, ...status.unstaged, ...status.untracked].map(file => [file.path, file])).values()]
    .map(file => ({ id: `worktree:${file.path}`, section: conflicts.has(file.path) ? "conflicts" as const : "unstaged" as const, file }))
  return [...staged, ...worktree]
}

let statusViewActive = false
const statusViewListeners = new Set<() => void>()
export function publishGitStatusView(active: boolean) {
  if (statusViewActive === active) return
  statusViewActive = active
  statusViewListeners.forEach(listener => listener())
}
export function useGitStatusView() {
  return useSyncExternalStore(
    listener => { statusViewListeners.add(listener); return () => { statusViewListeners.delete(listener) } },
    () => statusViewActive,
    () => false
  )
}
