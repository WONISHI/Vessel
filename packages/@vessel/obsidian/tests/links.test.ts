import { expect, it } from "vitest"
import { parseObsidianLinks } from "@vessel/obsidian"

it("parses aliases, root-relative wiki paths and multiple HTTP links without losing surrounding text", () => {
  expect(parseObsidianLinks("项目 [[工作/笔记#标题|展示名]] 1. https://example.com:8080/a.git，https://example.com/b?q=1#part")).toEqual([
    { kind: "text", text: "项目 " },
    { kind: "wiki", text: "展示名", target: "工作/笔记" },
    { kind: "text", text: " 1. " },
    { kind: "url", text: "https://example.com:8080/a.git", target: "https://example.com:8080/a.git" },
    { kind: "text", text: "，" },
    { kind: "url", text: "https://example.com/b?q=1#part", target: "https://example.com/b?q=1#part" }
  ])
})

it("keeps unsafe protocols and escaped wiki links as plain text", () => {
  const text = "javascript:alert(1) \\[[笔记]]"
  expect(parseObsidianLinks(text)).toEqual([{ kind: "text", text }])
})
