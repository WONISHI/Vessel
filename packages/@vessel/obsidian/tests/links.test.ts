import { expect, it } from "vitest"
import {
  buildMarkdownLink,
  findAllMarkdownLinks,
  normalizeLinkUrl,
  parseMarkdownLink,
  parseObsidianLinks
} from "@vessel/obsidian"

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

it("normalizes markdown link URLs correctly", () => {
  expect(normalizeLinkUrl("google.com")).toBe("https://google.com")
  expect(normalizeLinkUrl("https://github.com")).toBe("https://github.com")
  expect(normalizeLinkUrl("https://https://github.com")).toBe("https://github.com")
  expect(normalizeLinkUrl("mailto:user@test.com")).toBe("mailto:user@test.com")
  expect(normalizeLinkUrl("#anchor")).toBe("#anchor")

  expect(buildMarkdownLink("百度", "https://baidu.com")).toBe("[百度](https://baidu.com)")
  expect(parseMarkdownLink("[百度](https://baidu.com)")).toEqual({ text: "百度", url: "https://baidu.com" })

  const all = findAllMarkdownLinks("看看 [链接1](https://a.com) 以及 [链接2](https://b.com)")
  expect(all).toHaveLength(2)
  expect(all[0].url).toBe("https://a.com")
  expect(all[1].url).toBe("https://b.com")
})

