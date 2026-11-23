import { useState } from "react"
import { useGitStashView } from "./use-git-stash-view"
import { useGitRepository } from "@/pages/git/hooks/use-git-repository"
import { useGitFileSelection } from "@/pages/git/hooks/use-git-file-selection"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"
import { useGitCommitActions } from "@/pages/git/hooks/use-git-commit-actions"

/** 汇总 Git 页面所需的全部状态与操作 */
export function useGitPage() {
  const repo = useGitRepository()
  const [filter, setFilter] = useState({ repoPath: "", staged: "", unstaged: "" })
  const stagedFileQuery = filter.repoPath === repo.repoPath ? filter.staged : ""
  const unstagedFileQuery = filter.repoPath === repo.repoPath ? filter.unstaged : ""
  const setFileQuery = (section: "staged" | "unstaged", query: string) => setFilter(previous => ({
    repoPath: repo.repoPath,
    staged: previous.repoPath === repo.repoPath ? previous.staged : "",
    unstaged: previous.repoPath === repo.repoPath ? previous.unstaged : "",
    [section]: query
  }))
  const setStagedFileQuery = (query: string) => setFileQuery("staged", query)
  const setUnstagedFileQuery = (query: string) => setFileQuery("unstaged", query)
  const stashView = useGitStashView(repo)
  const selection = useGitFileSelection(repo, { staged: stagedFileQuery, unstaged: unstagedFileQuery })
  const fileActions = useGitFileActions(repo)
  const commitActions = useGitCommitActions(repo, fileActions.requestConfirmation)
  return { stagedFileQuery, unstagedFileQuery, setStagedFileQuery, setUnstagedFileQuery, ...repo, ...stashView, ...selection, ...fileActions, ...commitActions }
}

export type GitPageModel = ReturnType<typeof useGitPage>
