import type { GitCommitItem } from "@vessel/type"
import type { GitLogEntry } from "@tomplum/react-git-log"

/** Assign first-parent paths without guessing branch membership from message text. */
export function toGitLogEntries(commits: GitCommitItem[], currentBranch: string): GitLogEntry[] {
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]))
  const paths = new Map<string, string>()
  const assign = (hash: string, branch: string) => {
    let next: string | undefined = hash
    while (next && byHash.has(next) && !paths.has(next)) {
      paths.set(next, branch)
      next = byHash.get(next)?.parents[0]
    }
  }
  const head = commits.find((commit) => commit.refs.some((ref) => ref === "HEAD" || ref.startsWith("HEAD -> ")))
    ?? commits.find((commit) => commit.refs.includes(currentBranch))
    ?? commits[0]
  if (head) assign(head.hash, currentBranch || "HEAD")
  for (const commit of commits) {
    const ref = commit.refs.find((ref) => !ref.startsWith("tag:") && !ref.endsWith("/HEAD"))
    assign(commit.hash, ref?.replace(/^HEAD -> /, "") || currentBranch || "HEAD")
  }
  return commits.map((commit) => ({
    hash: commit.hash,
    parents: commit.parents,
    branch: commit.refs.some((ref) => ref === "HEAD" || ref.startsWith("HEAD -> "))
      ? paths.get(commit.hash)!
      : commit.refs.find((ref) => ref.startsWith("tag:"))?.replace(/^tag:\s*/, "refs/tags/") ?? paths.get(commit.hash)!,
    message: commit.message,
    author: { name: commit.author, email: commit.email },
    committerDate: new Date(commit.timestamp).toISOString()
  }))
}
