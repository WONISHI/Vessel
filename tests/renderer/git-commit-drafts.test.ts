import { expect, it } from "vitest"
import { getCommitDraft, syncMergeCommitDraft } from "@/pages/git/commit-drafts"

it("retains drafts across route visits, isolates repositories and retains successful clears", () => {
  getCommitDraft("/draft-a").current = "feat: draft"
  expect(getCommitDraft("/draft-a").current).toBe("feat: draft")
  expect(getCommitDraft("/draft-b").current).toBe("")
  getCommitDraft("/draft-a").current = ""
  expect(getCommitDraft("/draft-a").current).toBe("")
})

it("seeds and clears merge defaults without replacing user drafts or edited defaults", () => {
  const draft = { current: "" }
  expect(syncMergeCommitDraft(draft, "Merge branch 'dev'")).toBe(true)
  expect(draft.current).toBe("Merge branch 'dev'")
  expect(syncMergeCommitDraft(draft, "Merge branch 'dev'")).toBe(false)
  expect(syncMergeCommitDraft(draft)).toBe(true)
  expect(draft.current).toBe("")
  draft.current = "custom description"
  expect(syncMergeCommitDraft(draft, "Merge branch 'dev'")).toBe(false)
  expect(draft.current).toBe("custom description")
  draft.current = ""
  syncMergeCommitDraft(draft, "Merge branch 'dev'")
  draft.current += " with fixes"
  expect(syncMergeCommitDraft(draft)).toBe(false)
  expect(draft.current).toBe("Merge branch 'dev' with fixes")
})
