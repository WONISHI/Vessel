export interface GitFileStatus {
  path: string
  status: "M" | "A" | "D" | "R" | "C" | "U" | "?"
  oldPath?: string
}

export interface GitStatusResult {
  isRepo: boolean
  branch: string
  upstream: string
  ahead: number
  behind: number
  staged: GitFileStatus[]
  unstaged: GitFileStatus[]
  untracked: GitFileStatus[]
  conflicts: GitFileStatus[]
}

export interface GitCommitItem {
  hash: string
  shortHash: string
  parents: string[]
  author: string
  email: string
  timestamp: number
  date: string
  message: string
  refs: string[]
}

export interface GitCommitDetail {
  hash: string
  parents: string[]
  author: string
  email: string
  date: string
  message: string
  files: { path: string; status: string; additions: number; deletions: number }[]
}

export interface GitDiffResult {
  diff: string
  oldContent?: string
  newContent?: string
}
