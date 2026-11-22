import { expect, it } from "vitest"
import { localizeCommitTime } from "@/pages/git/components/localize-commit-time"
it.each([
  ["17 hours ago", "17 小时前"], ["a day ago", "1 天前"], ["an hour ago", "1 小时前"],
  ["a few seconds ago", "几秒前"], ["a minute ago", "1 分钟前"], ["30 minutes ago", "30 分钟前"],
  ["3 days ago", "3 天前"], ["a month ago", "1 个月前"], ["2 years ago", "2 年前"],
  ["in 2 hours", "2 小时后"], ["-", "-"], ["2026-11-21 10:00:00", "2026-11-21 10:00:00"], ["17 小时前", "17 小时前"]
])("localises %s without changing absolute dates or existing Chinese", (input, expected) => {
  expect(localizeCommitTime(input)).toBe(expected)
})
