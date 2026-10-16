import { expect, it, describe } from "vitest"
import { cleanHtml, resolveUrl, htmlToMarkdown, buildClipMarkdown } from "../src/parser"
import type { PageMetadata } from "../src/types"

describe("Clipper Parser", () => {
  it("resolves relative URLs correctly", () => {
    expect(resolveUrl("/article/123", "https://example.com/blog/")).toBe("https://example.com/article/123")
    expect(resolveUrl("img.png", "https://example.com/blog/")).toBe("https://example.com/blog/img.png")
    expect(resolveUrl("https://other.com/a", "https://example.com/")).toBe("https://other.com/a")
  })

  it("cleans noisy HTML tags", () => {
    const dirty = `<div><script>alert(1)</script><p>Hello</p><style>.a{}</style><iframe></iframe></div>`
    const cleaned = cleanHtml(dirty)
    expect(cleaned).not.toContain("<script>")
    expect(cleaned).not.toContain("<style>")
    expect(cleaned).not.toContain("<iframe>")
    expect(cleaned).toContain("<p>Hello</p>")
  })

  it("converts HTML to Markdown correctly", () => {
    const html = `
      <h1>主要标题</h1>
      <p>这是一段包含 <strong>粗体</strong> 和 <em>斜体</em> 的文字，还有 <a href="https://example.com">链接</a>。</p>
      <pre><code class="language-js">console.log("hello")</code></pre>
      <blockquote>这是一句引用</blockquote>
      <ul>
        <li>项目 1</li>
        <li>项目 2</li>
      </ul>
    `
    const md = htmlToMarkdown(html, "https://example.com")
    expect(md).toContain("# 主要标题")
    expect(md).toContain("**粗体**")
    expect(md).toContain("*斜体*")
    expect(md).toContain("[链接](https://example.com)")
    expect(md).toContain("```js")
    expect(md).toContain("console.log(\"hello\")")
    expect(md).toContain("> 这是一句引用")
    expect(md).toContain("- 项目 1")
    expect(md).toContain("- 项目 2")
  })

  it("builds complete clip markdown with YAML frontmatter and notes", () => {
    const meta: PageMetadata = {
      title: "深入浅出 React 核心原理",
      url: "https://example.com/react-core",
      author: "Dan Abramov",
      description: "关于 React 渲染和调度机制的深度解析",
      timestamp: "2026-10-16T12:00:00Z"
    }

    const md = buildClipMarkdown(meta, "bookmark", ["前端", "React"], "这是我非常喜欢的一篇好文章")
    expect(md).toContain("---")
    expect(md).toContain('title: "深入浅出 React 核心原理"')
    expect(md).toContain('author: "Dan Abramov"')
    expect(md).toContain("  - 前端")
    expect(md).toContain("  - React")
    expect(md).toContain("### 📝 我的笔记与标注")
    expect(md).toContain("这是我非常喜欢的一篇好文章")
    expect(md).toContain("关于 React 渲染和调度机制的深度解析")
  })

  it("uses articleText fallback when articleHtml is not available", () => {
    const meta: PageMetadata = {
      title: "测试文章",
      url: "https://example.com/test",
      articleText: "这是从网页直接提取到的纯文本正文内容",
      timestamp: "2026-10-16T12:00:00Z"
    }

    const md = buildClipMarkdown(meta, "article")
    expect(md).toContain("这是从网页直接提取到的纯文本正文内容")
    expect(md).not.toContain("未能自动提取到正文内容")
  })
})
