import type { PageMetadata, ClipMode } from "./types"

/**
 * 将相对 URL 解析为基于页面的绝对 URL
 */
export function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href
  } catch {
    return href
  }
}

/**
 * 清除 HTML 中无关的噪音标签（导航、侧边栏、广告、脚本、样式等）
 */
export function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
}

/**
 * 将 HTML 元素节点递归转换为精简 Markdown 文本
 */
export function elementToMarkdown(element: Element, baseUrl: string): string {
  const tagName = element.tagName.toLowerCase()

  // 忽略不可视元素或干扰元素
  if (["script", "style", "noscript", "iframe", "svg", "nav", "footer"].includes(tagName)) {
    return ""
  }

  // 标题
  if (/^h[1-6]$/.test(tagName)) {
    const level = parseInt(tagName[1], 10)
    const text = element.textContent?.trim() || ""
    return `\n\n${"#".repeat(level)} ${text}\n\n`
  }

  // 段落
  if (tagName === "p") {
    const childrenMd = Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, baseUrl))
      .join("")
      .trim()
    return childrenMd ? `\n\n${childrenMd}\n\n` : ""
  }

  // 块级容器元素（避免文字直接粘连）
  if (["div", "section", "article", "figure", "header", "main", "aside", "details", "summary"].includes(tagName)) {
    const childrenMd = Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, baseUrl))
      .join("")
      .trim()
    return childrenMd ? `\n\n${childrenMd}\n\n` : ""
  }

  // 粗体
  if (tagName === "strong" || tagName === "b") {
    const text = element.textContent?.trim() || ""
    return text ? `**${text}**` : ""
  }

  // 斜体
  if (tagName === "em" || tagName === "i") {
    const text = element.textContent?.trim() || ""
    return text ? `*${text}*` : ""
  }

  // 删除线
  if (tagName === "del" || tagName === "s" || tagName === "strike") {
    const text = element.textContent?.trim() || ""
    return text ? `~~${text}~~` : ""
  }

  // 链接
  if (tagName === "a") {
    const href = element.getAttribute("href")
    const text = element.textContent?.trim() || href || ""
    if (!href) return text
    const fullHref = resolveUrl(href, baseUrl)
    return `[${text}](${fullHref})`
  }

  // 图片（支持主流懒加载属性）
  if (tagName === "img") {
    const src =
      element.getAttribute("src") ||
      element.getAttribute("data-src") ||
      element.getAttribute("data-original-src") ||
      element.getAttribute("data-actualsrc") ||
      element.getAttribute("data-lazy-src")
    if (!src) return ""
    const alt = element.getAttribute("alt") || "image"
    const fullSrc = resolveUrl(src, baseUrl)
    return `\n\n![${alt}](${fullSrc})\n\n`
  }

  // 代码块
  if (tagName === "pre") {
    const codeEl = element.querySelector("code")
    const code = (codeEl ? codeEl.textContent : element.textContent) || ""
    let lang = ""
    const classAttr = (codeEl?.getAttribute("class") || element.getAttribute("class") || "")
    const langMatch = classAttr.match(/language-([a-zA-Z0-9_-]+)/)
    if (langMatch) lang = langMatch[1]
    return `\n\n\`\`\`${lang}\n${code.replace(/^\n+|\n+$/g, "")}\n\`\`\`\n\n`
  }

  // 行内代码
  if (tagName === "code") {
    const text = element.textContent || ""
    return `\`${text}\``
  }

  // 引用
  if (tagName === "blockquote") {
    const content = Array.from(element.childNodes)
      .map((child) => nodeToMarkdown(child, baseUrl))
      .join("")
      .trim()
    return `\n\n${content.split("\n").map((line) => `> ${line}`).join("\n")}\n\n`
  }

  // 无序列表
  if (tagName === "ul") {
    const items = Array.from(element.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li) => {
        const text = Array.from(li.childNodes).map((c) => nodeToMarkdown(c, baseUrl)).join("").trim()
        return `- ${text}`
      })
      .join("\n")
    return `\n\n${items}\n\n`
  }

  // 有序列表
  if (tagName === "ol") {
    const items = Array.from(element.children)
      .filter((c) => c.tagName.toLowerCase() === "li")
      .map((li, index) => {
        const text = Array.from(li.childNodes).map((c) => nodeToMarkdown(c, baseUrl)).join("").trim()
        return `${index + 1}. ${text}`
      })
      .join("\n")
    return `\n\n${items}\n\n`
  }

  // 表格
  if (tagName === "table") {
    const rows = Array.from(element.querySelectorAll("tr"))
    if (!rows.length) return ""
    let tableMd = "\n\n"
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("th, td")).map((cell) => cell.textContent?.trim().replace(/\|/g, "\\|") || "")
      if (cells.length) {
        tableMd += `| ${cells.join(" | ")} |\n`
        if (rowIndex === 0) {
          tableMd += `| ${cells.map(() => "---").join(" | ")} |\n`
        }
      }
    })
    return tableMd + "\n"
  }

  // 分割线
  if (tagName === "hr") {
    return "\n\n---\n\n"
  }

  // 换行
  if (tagName === "br") {
    return "\n"
  }

  // 默认遍历子节点
  return Array.from(element.childNodes)
    .map((child) => nodeToMarkdown(child, baseUrl))
    .join("")
}

/**
 * 将任意 DOM Node 转换为 Markdown
 */
export function nodeToMarkdown(node: Node, baseUrl: string): string {
  if (node.nodeType === 3) {
    // 文本节点
    return node.textContent || ""
  }
  if (node.nodeType === 1) {
    return elementToMarkdown(node as Element, baseUrl)
  }
  return ""
}

/**
 * 将 HTML 字符串转换为规范 Markdown
 */
export function htmlToMarkdown(html: string, baseUrl: string): string {
  if (!html) return ""
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleanHtml(html), "text/html")
    const md = Array.from(doc.body.childNodes)
      .map((node) => nodeToMarkdown(node, baseUrl))
      .join("")
    // 规范化空行
    return md.replace(/\n{3,}/g, "\n\n").trim()
  }

  // 简易正则降级（如在无 DOM 环境）
  return cleanHtml(html)
    .replace(/<pre[^>]*><code[^>]*class="[^"]*language-([a-zA-Z0-9_-]+)[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n\n```$1\n$2\n```\n\n")
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n\n```\n$1\n```\n\n")
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n\n```\n$1\n```\n\n")
    .replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_match, p1) => `\n\n> ${p1.trim().replace(/\n/g, "\n> ")}\n\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1")
    .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_m, level, text) => `\n\n${"#".repeat(Number(level))} ${text.trim()}\n\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "\n\n$1\n\n")
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<del[^>]*>(.*?)<\/del>/gi, "~~$1~~")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * 生成包含 Frontmatter 元数据的完整 Markdown 文件内容
 */
export function buildClipMarkdown(
  meta: PageMetadata,
  mode: ClipMode = "article",
  tags: string[] = [],
  notes = ""
): string {
  const dateStr = meta.timestamp || new Date().toISOString()
  const frontmatter = [
    "---",
    `title: "${(meta.title || "未命名网页").replace(/"/g, '\\"')}"`,
    `url: "${meta.url || ""}"`,
    `clipped_at: "${dateStr}"`,
    meta.author ? `author: "${meta.author.replace(/"/g, '\\"')}"` : null,
    meta.siteName ? `site_name: "${meta.siteName.replace(/"/g, '\\"')}"` : null,
    tags.length ? `tags:\n${tags.map((t) => `  - ${t}`).join("\n")}` : `tags: [剪藏]`,
    "---",
    ""
  ]
    .filter((line) => line !== null)
    .join("\n")

  const header = [
    `# ${meta.title || "未命名网页"}`,
    "",
    `> 原文链接: [${meta.url}](${meta.url})`,
    meta.author ? `> 作者: ${meta.author}` : null,
    `> 剪藏时间: ${dateStr.slice(0, 19).replace("T", " ")}`,
    ""
  ]
    .filter((line) => line !== null)
    .join("\n")

  const notesSection = notes.trim()
    ? `\n### 📝 我的笔记与标注\n\n${notes.trim()}\n\n---\n`
    : ""

  let body = ""
  if (mode === "bookmark") {
    body = meta.description
      ? `\n### 简介\n\n${meta.description}\n`
      : `\n### 网址书签已收录\n\n已成功保存网址至 Vessel 工作区。\n`
  } else if (mode === "selection") {
    const selectedMd = meta.selectedHtml
      ? htmlToMarkdown(meta.selectedHtml, meta.url)
      : meta.selectedText || ""
    body = `\n### 摘录内容\n\n${selectedMd}\n`
  } else {
    // article mode
    let articleMd = meta.articleHtml ? htmlToMarkdown(meta.articleHtml, meta.url) : ""
    if (!articleMd.trim()) {
      articleMd = meta.articleText
        ? meta.articleText
        : meta.selectedText
          ? `### 摘录内容\n\n${meta.selectedText}`
          : meta.description
            ? `### 页面简介\n\n${meta.description}`
            : `> ⚠️ 未能自动提取到正文内容。若页面使用特殊动态渲染，建议在网页上选中文本后使用【✂️ 选中文字】模式剪藏。`
    }
    body = `\n${articleMd}\n`
  }

  return `${frontmatter}\n${header}${notesSection}${body}`
}
