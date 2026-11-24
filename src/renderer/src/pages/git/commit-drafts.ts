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

// Track only untouched generated messages so refreshes never replace user edits.
const mergeDefaults = new WeakMap<{ current: string }, string>()
export function syncMergeCommitDraft(draft: { current: string }, message?: string): boolean {
  const previous = mergeDefaults.get(draft)
  if (draft.current && draft.current !== previous) return false
  if (message) mergeDefaults.set(draft, message)
  else mergeDefaults.delete(draft)
  const next = message || ""
  if (draft.current === next) return false
  draft.current = next
  return true
}
