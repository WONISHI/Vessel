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


it("merges edits to different words on the same Chinese or English line", () => {
  expect(mergeMarkdown("Python 是一门语言，适合入门学习。\n", "Python 是一门解释型语言，适合入门学习。\n", "Python 是一门语言，适合初学者入门学习。\n")).toBe("Python 是一门解释型语言，适合初学者入门学习。\n")
  expect(mergeMarkdown("name: Alice, age: 20\n", "name: Bob, age: 20\n", "name: Alice, age: 21\n")).toBe("name: Bob, age: 21\n")
})
it("does not treat Windows line endings as conflicting edits", () => {
  expect(mergeMarkdown("title\nbody\n", "title\r\nbody\r\n", "title\nupdated body\n")).toBe("title\r\nupdated body\r\n")
})
it("merges small changes inside long notes without a full document LCS matrix", () => {
  const prefix = "unchanged line\n".repeat(2000), suffix = "more context\n".repeat(2000)
  expect(mergeMarkdown(prefix + "one and two\n" + suffix, prefix + "ONE and two\n" + suffix, prefix + "one and TWO\n" + suffix)).toBe(prefix + "ONE and TWO\n" + suffix)
})
it("still refuses conflicting edits to the same word or insertion point", () => {
  expect(mergeMarkdown("姓名：张三\n", "姓名：李四\n", "姓名：王五\n")).toBeUndefined()
  expect(mergeMarkdown("abc", "aXbc", "aYbc")).toBeUndefined()
})
