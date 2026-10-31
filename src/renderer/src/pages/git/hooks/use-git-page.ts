import { useGitRepository } from "@/pages/git/hooks/use-git-repository"
import { useGitFileSelection } from "@/pages/git/hooks/use-git-file-selection"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"
import { useGitCommitActions } from "@/pages/git/hooks/use-git-commit-actions"

/** 汇总 Git 页面所需的全部状态与操作 */
export function useGitPage() {
  const repo = useGitRepository()
  const selection = useGitFileSelection(repo)
  const fileActions = useGitFileActions(repo)
  const commitActions = useGitCommitActions(repo)
  return { ...repo, ...selection, ...fileActions, ...commitActions }
}

export type GitPageModel = ReturnType<typeof useGitPage>
