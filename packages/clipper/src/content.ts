import type { PageMetadata } from "./types"

/**
 * 提取页面主体文章 HTML
 */
function extractArticleHtml(): string {
  // 1. 尝试寻找明确的主体文章选择器
  const selectors = [
    "#js_content", // 微信公众号
    ".Post-RichText",
    ".RichContent-inner", // 知乎
    "#content_views",
    ".article_content", // CSDN
    ".article-viewer",
    ".markdown-body", // 掘金, GitHub
    ".article-holder",
    ".article-content", // B站专栏
    "article",
    "main",
    "[role='main']",
    ".post-content",
    ".article-content",
    ".entry-content",
    "#article-root",
    "#content",
    ".article",
    ".post_body",
    ".post-body"
  ]

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel)
      if (el && ((el as HTMLElement).innerText || el.textContent || "").trim().length > 20) {
        return el.innerHTML
      }
    } catch (_) {}
  }

  // 2. 启发式：寻找正文段落与文字密度最高的容器元素
  try {
    const candidates = Array.from(document.querySelectorAll("div, section"))
    let bestEl: Element | null = null
    let maxScore = 0
    for (const el of candidates) {
      if (el.closest("nav, header, footer, aside, .sidebar, .comments")) continue
      const textLen = ((el as HTMLElement).innerText || "").trim().length
      if (textLen < 50) continue
      const pCount = el.querySelectorAll("p").length
      const score = textLen + pCount * 120
      if (score > maxScore) {
        maxScore = score
        bestEl = el
      }
    }
    if (bestEl && maxScore > 200) {
      return bestEl.innerHTML
    }
  } catch (_) {}

  // 3. 降级：使用 body 的副本，移除已知非内容块
  const body = document.body || document.documentElement
  if (!body) return ""
  const clone = body.cloneNode(true) as HTMLElement
  const removeSelectors = [
    "script",
    "style",
    "noscript",
    "iframe",
    "nav",
    "header",
    "footer",
    "aside",
    ".sidebar",
    ".comments",
    ".advertisement",
    ".ad",
    "#sidebar",
    "#footer",
    "#header"
  ]
  removeSelectors.forEach((sel) => {
    try {
      clone.querySelectorAll(sel).forEach((node) => node.remove())
    } catch (_) {}
  })

  return clone.innerHTML
}

/**
 * 提取选中文本及选中 DOM 的 HTML
 */
function extractSelection(): { text: string; html: string } {
  try {
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return { text: "", html: "" }
    }

    const text = selection.toString().trim()
    const range = selection.getRangeAt(0)
    const container = document.createElement("div")
    container.appendChild(range.cloneContents())
    const html = container.innerHTML

    return { text, html }
  } catch (_) {
    return { text: "", html: "" }
  }
}

/**
 * 提取当前页面元数据
 */
function getPageMetadata(): PageMetadata {
  const getMeta = (names: string[]): string => {
    for (const name of names) {
      try {
        const el = document.querySelector(`meta[name='${name}'], meta[property='${name}']`)
        if (el) {
          const val = el.getAttribute("content")
          if (val) return val.trim()
        }
      } catch (_) {}
    }
    return ""
  }

  const selection = extractSelection()
  const faviconEl = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null

  return {
    title: document.title || "未命名网页",
    url: window.location.href,
    description: getMeta(["description", "og:description", "twitter:description"]),
    author: getMeta(["author", "article:author", "twitter:creator"]),
    siteName: getMeta(["og:site_name", "application-name"]) || window.location.hostname,
    favicon: faviconEl ? faviconEl.href : `${window.location.origin}/favicon.ico`,
    selectedText: selection.text,
    selectedHtml: selection.html,
    articleHtml: extractArticleHtml(),
    timestamp: new Date().toISOString()
  }
}

// 监听来自扩展 Popup 或 Background 的请求
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "GET_PAGE_DATA") {
      sendResponse(getPageMetadata())
    }
    return true
  })
}
