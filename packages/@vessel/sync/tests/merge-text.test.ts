import { expect, it } from "vitest"
import { mergeMarkdown } from "#vessel-sync/merge-text"

it("merges multiple independent edits while retaining line endings", () => {
  expect(mergeMarkdown("a\r\nb\r\nc\r\nd\r\ne\r\n", "A\r\nb\r\nc\r\nd\r\nE\r\n", "a\r\nb\r\nC\r\nd\r\ne\r\n")).toBe("A\r\nb\r\nC\r\nd\r\nE\r\n")
})
it("deduplicates identical edits but refuses overlapping edits and ambiguous insertions", () => {
  expect(mergeMarkdown("a\nb\nc\n", "A\nb\nc\n", "A\nb\nC\n")).toBe("A\nb\nC\n")
  expect(mergeMarkdown("a\nb\n", "A\nb\n", "B\nb\n")).toBeUndefined()
  expect(mergeMarkdown("a\n", "x\na\n", "y\na\n")).toBeUndefined()
})
it("preserves independent deletions and insertions and rejects binary or excessive inputs", () => {
  expect(mergeMarkdown("a\nb\nc\nd\n", "a\nc\nd\n", "a\nb\nc\nd\ne\n")).toBe("a\nc\nd\ne\n")
  expect(mergeMarkdown("a", "a\0", "b")).toBeUndefined()
  expect(mergeMarkdown("a", "x".repeat(262145), "b")).toBeUndefined()
})
it("resolves progressive typing on the same line or at the end of a note", () => {
  expect(mergeMarkdown("# 第七章 快速入门\n\nPython 是\n", "# 第七章 快速入门\n\nPython 是一门解释型语言\n", "# 第七章 快速入门\n\nPython 是一门\n")).toBe("# 第七章 快速入门\n\nPython 是一门解释型语言\n")
  expect(mergeMarkdown("# 第七章 快速入门\n", "# 第七章 快速入门\n## 7.1 简介\n## 7.2 语法\n", "# 第七章 快速入门\n## 7.1 简介\n")).toBe("# 第七章 快速入门\n## 7.1 简介\n## 7.2 语法\n")
})

