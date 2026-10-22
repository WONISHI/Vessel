import { expect, it } from "vitest"
import { parseHighlights } from "../src/highlights"

it("parses multiple Chinese highlights with original ranges", () => {
  const source = "==ITIL(信息技术基础架构库）==、==ITSM(IT服务管理)==、==ITSS（信息技术服务标准）=="
  const matches = parseHighlights(source)
  expect(matches.map((match) => match.content)).toEqual(["ITIL(信息技术基础架构库）", "ITSM(IT服务管理)", "ITSS（信息技术服务标准）"])
  for (const match of matches) expect(source.slice(match.start, match.end)).toBe(match.raw)
})
it("ignores code, escaped delimiters, empty and unclosed highlights", () => {
  expect(parseHighlights("`==code==`\n```text\n==code==\n```\n\\==escaped==\n====\n== ==\n==unclosed")).toEqual([])
  expect(parseHighlights("==first==\n==second==").map((match) => match.content)).toEqual(["first", "second"])
})
