import { expect, it } from "vitest"
import { getCommitDraft } from "@/pages/git/commit-drafts"

it("retains drafts across route visits, isolates repositories and retains successful clears", () => {
  getCommitDraft("/draft-a").current = "feat: draft"
  expect(getCommitDraft("/draft-a").current).toBe("feat: draft")
  expect(getCommitDraft("/draft-b").current).toBe("")
  getCommitDraft("/draft-a").current = ""
  expect(getCommitDraft("/draft-a").current).toBe("")
})
