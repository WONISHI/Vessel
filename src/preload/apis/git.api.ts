import type { GitCommitDetail, GitCommitItem, GitDiffResult, GitStatusResult } from "@vessel/type"
import { ipcRenderer } from "electron"

export const gitAPI = {
  /** Checks whether repo. */
  isRepo: (cwd: string): Promise<boolean> => ipcRenderer.invoke("git:is-repo", cwd),

  /** Initializes init. */
  init: (cwd: string): Promise<void> => ipcRenderer.invoke("git:init", cwd),

  /** Returns status. */
  getStatus: (cwd: string): Promise<GitStatusResult> => ipcRenderer.invoke("git:status", cwd),

  /** Returns branches. */
  getBranches: (cwd: string): Promise<{ local: string[]; remote: string[]; current: string }> => ipcRenderer.invoke("git:branches", cwd),

  /** Returns log. */
  getLog: (cwd: string, maxCount?: number, skip?: number): Promise<GitCommitItem[]> => ipcRenderer.invoke("git:log", cwd, maxCount, skip),

  /** Counts commits in repository history. */
  getLogCount: (cwd: string): Promise<number> => ipcRenderer.invoke("git:log-count", cwd),

  /** Returns commit detail. */
  getCommitDetail: (cwd: string, hash: string): Promise<GitCommitDetail> => ipcRenderer.invoke("git:commit-detail", cwd, hash),

  /** Returns diff. */
  getDiff: (cwd: string, filePath: string, staged?: boolean, commitHash?: string): Promise<GitDiffResult> => ipcRenderer.invoke("git:diff", cwd, filePath, staged, commitHash),

  /** Performs the stage operation. */
  stage: (cwd: string, files: string[]): Promise<void> => ipcRenderer.invoke("git:stage", cwd, files),

  /** Performs the unstage operation. */
  unstage: (cwd: string, files: string[]): Promise<void> => ipcRenderer.invoke("git:unstage", cwd, files),

  /** Performs the stage all operation. */
  stageAll: (cwd: string): Promise<void> => ipcRenderer.invoke("git:stage-all", cwd),

  /** Performs the unstage all operation. */
  unstageAll: (cwd: string): Promise<void> => ipcRenderer.invoke("git:unstage-all", cwd),

  /** Performs the discard operation. */
  discard: (cwd: string, files: string[], isUntracked?: boolean): Promise<void> => ipcRenderer.invoke("git:discard", cwd, files, isUntracked),

  /** Performs the commit operation. */
  commit: (cwd: string, message: string, amend?: boolean): Promise<void> => ipcRenderer.invoke("git:commit", cwd, message, amend),

  /** Performs the checkout operation. */
  checkout: (cwd: string, branch: string): Promise<void> => ipcRenderer.invoke("git:checkout", cwd, branch),

  /** Creates branch. */
  createBranch: (cwd: string, name: string, startPoint?: string, checkout?: boolean): Promise<void> => ipcRenderer.invoke("git:create-branch", cwd, name, startPoint, checkout),

  /** Deletes branch. */
  deleteBranch: (cwd: string, name: string, force?: boolean): Promise<void> => ipcRenderer.invoke("git:delete-branch", cwd, name, force),

  /** Fetches fetch. */
  fetch: (cwd: string, remote?: string): Promise<void> => ipcRenderer.invoke("git:fetch", cwd, remote),

  /** Performs the pull operation. */
  pull: (cwd: string, remote?: string, branch?: string): Promise<{ output: string }> => ipcRenderer.invoke("git:pull", cwd, remote, branch),

  /** Pushes push. */
  push: (cwd: string, remote?: string, branch?: string, force?: boolean): Promise<{ output: string }> => ipcRenderer.invoke("git:push", cwd, remote, branch, force),

  /** Merges merge. */
  merge: (cwd: string, branch: string): Promise<{ success: boolean; output: string }> => ipcRenderer.invoke("git:merge", cwd, branch),

  /** Returns stashes. */
  getStashes: (cwd: string): Promise<{ index: number; name: string; date: string }[]> => ipcRenderer.invoke("git:stashes", cwd),

  /** Performs the stash save operation. */
  stashSave: (cwd: string, message?: string, files?: string[]): Promise<void> => ipcRenderer.invoke("git:stash-save", cwd, message, files),

  /** Performs the stash pop operation. */
  stashPop: (cwd: string, index?: number): Promise<void> => ipcRenderer.invoke("git:stash-pop", cwd, index),

  /** Performs the stash drop operation. */
  stashDrop: (cwd: string, index?: number): Promise<void> => ipcRenderer.invoke("git:stash-drop", cwd, index),

  /** Resets reset. */
  reset: (cwd: string, target: string, mode?: "soft" | "mixed" | "hard"): Promise<void> => ipcRenderer.invoke("git:reset", cwd, target, mode),

  /** Performs the revert operation. */
  revert: (cwd: string, hash: string): Promise<void> => ipcRenderer.invoke("git:revert", cwd, hash),

  /** Creates tag. */
  createTag: (cwd: string, tag: string, target?: string): Promise<void> => ipcRenderer.invoke("git:create-tag", cwd, tag, target),

  /** Returns the remote repository URL, prioritizing origin. */
  getRemoteUrl: (cwd: string, remote?: string): Promise<string> => ipcRenderer.invoke("git:remote-url", cwd, remote),

  /** Returns the web URL for viewing a commit in the remote repository. */
  getRemoteCommitUrl: (cwd: string, hash: string, remote?: string): Promise<string> => ipcRenderer.invoke("git:remote-commit-url", cwd, hash, remote),

  /** Returns the list of unpushed commit hashes. */
  getUnpushedCommits: (cwd: string): Promise<string[]> => ipcRenderer.invoke("git:unpushed-commits", cwd)
}
