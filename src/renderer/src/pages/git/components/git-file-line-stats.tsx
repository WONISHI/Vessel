import type { GitFileStatus } from "@vessel/type/git"

export function GitFileLineStats({ file }: { file: GitFileStatus }) {
  if (!file.additions && !file.deletions) return null
  return <span data-git-line-stats className="flex shrink-0 items-center gap-2 whitespace-nowrap font-mono text-[10px] font-normal">
    {!!file.additions && <span className="text-green-600">+{file.additions}</span>}
    {!!file.deletions && <span className="text-red-600">−{file.deletions}</span>}
  </span>
}
