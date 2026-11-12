// Keep each repository's draft alive when the Git route unmounts.
const drafts = new Map<string, { current: string }>()
export function getCommitDraft(repoPath: string) {
  let draft = drafts.get(repoPath)
  if (!draft) {
    draft = { current: "" }
    drafts.set(repoPath, draft)
  }
  return draft
}
