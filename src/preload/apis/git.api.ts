import { ipcRenderer } from "electron"
import type {
  GitStatusResult,
  GitCommitItem,
  GitCommitDetail,
  GitDiffResult
} from "../../main/modules/git/git-service"

export const gitAPI = {
  isRepo: (cwd: string): Promise<boolean> => ipcRenderer.invoke("git:is-repo", cwd),
  init: (cwd: string): Promise<void> => ipcRenderer.invoke("git:init", cwd),
  getStatus: (cwd: string): Promise<GitStatusResult> => ipcRenderer.invoke("git:status", cwd),
  getBranches: (cwd: string): Promise<{ local: string[]; remote: string[]; current: string }> =>
    ipcRenderer.invoke("git:branches", cwd),
  getLog: (cwd: string, maxCount?: number): Promise<GitCommitItem[]> =>
    ipcRenderer.invoke("git:log", cwd, maxCount),
  getCommitDetail: (cwd: string, hash: string): Promise<GitCommitDetail> =>
    ipcRenderer.invoke("git:commit-detail", cwd, hash),
  getDiff: (cwd: string, filePath: string, staged?: boolean, commitHash?: string): Promise<GitDiffResult> =>
    ipcRenderer.invoke("git:diff", cwd, filePath, staged, commitHash),
  stage: (cwd: string, files: string[]): Promise<void> => ipcRenderer.invoke("git:stage", cwd, files),
  unstage: (cwd: string, files: string[]): Promise<void> => ipcRenderer.invoke("git:unstage", cwd, files),
  stageAll: (cwd: string): Promise<void> => ipcRenderer.invoke("git:stage-all", cwd),
  unstageAll: (cwd: string): Promise<void> => ipcRenderer.invoke("git:unstage-all", cwd),
  discard: (cwd: string, files: string[], isUntracked?: boolean): Promise<void> =>
    ipcRenderer.invoke("git:discard", cwd, files, isUntracked),
  commit: (cwd: string, message: string, amend?: boolean): Promise<void> =>
    ipcRenderer.invoke("git:commit", cwd, message, amend),
  checkout: (cwd: string, branch: string): Promise<void> => ipcRenderer.invoke("git:checkout", cwd, branch),
  createBranch: (cwd: string, name: string, startPoint?: string, checkout?: boolean): Promise<void> =>
    ipcRenderer.invoke("git:create-branch", cwd, name, startPoint, checkout),
  deleteBranch: (cwd: string, name: string, force?: boolean): Promise<void> =>
    ipcRenderer.invoke("git:delete-branch", cwd, name, force),
  fetch: (cwd: string, remote?: string): Promise<void> => ipcRenderer.invoke("git:fetch", cwd, remote),
  pull: (cwd: string, remote?: string, branch?: string): Promise<{ output: string }> =>
    ipcRenderer.invoke("git:pull", cwd, remote, branch),
  push: (cwd: string, remote?: string, branch?: string, force?: boolean): Promise<{ output: string }> =>
    ipcRenderer.invoke("git:push", cwd, remote, branch, force),
  merge: (cwd: string, branch: string): Promise<{ success: boolean; output: string }> =>
    ipcRenderer.invoke("git:merge", cwd, branch),
  getStashes: (cwd: string): Promise<{ index: number; name: string; date: string }[]> =>
    ipcRenderer.invoke("git:stashes", cwd),
  stashSave: (cwd: string, message?: string, files?: string[]): Promise<void> =>
    ipcRenderer.invoke("git:stash-save", cwd, message, files),
  stashPop: (cwd: string, index?: number): Promise<void> => ipcRenderer.invoke("git:stash-pop", cwd, index),
  stashDrop: (cwd: string, index?: number): Promise<void> => ipcRenderer.invoke("git:stash-drop", cwd, index),
  reset: (cwd: string, target: string, mode?: "soft" | "mixed" | "hard"): Promise<void> =>
    ipcRenderer.invoke("git:reset", cwd, target, mode),
  revert: (cwd: string, hash: string): Promise<void> => ipcRenderer.invoke("git:revert", cwd, hash),
  createTag: (cwd: string, tag: string, target?: string): Promise<void> =>
    ipcRenderer.invoke("git:create-tag", cwd, tag, target)
}
