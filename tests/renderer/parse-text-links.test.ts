import { expect, it } from "vitest"
import { parseTextLinks } from "@/components/ui/link/components/parse-text-links"

it("preserves ports, encoded paths, fragments and balanced parentheses while dropping punctuation", () => {
  const links = parseTextLinks("(http://10.0.0.1:8080/docs), https://example.com/a(b)?id=1&view=read#/%E8%BF%90。")
  expect(links.map((link) => link.href)).toEqual(["http://10.0.0.1:8080/docs", "https://example.com/a(b)?id=1&view=read#/%E8%BF%90"])
})
it("recognizes web and email addresses without treating arbitrary account names as links", () => {
  expect(parseTextLinks("admin password@123")).toEqual([])
  expect(parseTextLinks("www.example.com dev@example.com mailto:help@example.com").map((link) => link.href)).toEqual(["https://www.example.com", "mailto:dev@example.com", "mailto:help@example.com"])
})
