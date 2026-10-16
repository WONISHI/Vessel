import type { PageMetadata } from "./types"

function cleanElement(node: HTMLElement) {
  if (!node) return
  const junkTags = [
    "script", "style", "noscript", "iframe", "svg", "canvas", "video", "audio",
    "nav", "header", "footer", "aside", "form", "button", "input", "select", "textarea",
    "dialog", "[aria-hidden='true']"
  ]
  junkTags.forEach((sel) => {
    try {
      node.querySelectorAll(sel).forEach((el) => el.remove())
    } catch (_) {}
  })

  const junkClasses = [
    ".sidebar", ".comments", "#comments", ".comment-list", ".ad", ".advertisement",
    ".share-wrap", ".social-share", ".recommend-box", ".related-posts", ".banner",
    ".footer", ".header", "#header", "#footer"
  ]
  junkClasses.forEach((sel) => {
    try {
      node.querySelectorAll(sel).forEach((el) => el.remove())
    } catch (_) {}
  })

  try {
    const imgs = node.querySelectorAll("img")
    imgs.forEach((img) => {
      const realSrc =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("data-actualsrc") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-url") ||
        img.src
      if (realSrc) {
        if (realSrc.startsWith("data:") && realSrc.length > 50000) {
          img.removeAttribute("src")
        } else {
          img.src = realSrc
        }
      }
    })
  } catch (_) {}
}

/**
 * 提取页面主体文章 HTML 和纯文本
 */
function extractArticle(): { html: string; text: string } {
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
    ".entry-content",
    ".post-content",
    "#article-root",
    "#content",
    "article",
    "main",
    "[role='main']",
    ".article",
    ".post_body",
    ".post-body"
  ]

  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel) as HTMLElement
      if (el) {
        const rawText = (el.innerText || el.textContent || "").trim()
        if (rawText.length > 30) {
          const clone = el.cloneNode(true) as HTMLElement
          cleanElement(clone)
          const cleanText = (clone.innerText || clone.textContent || "").trim()
          if (cleanText.length > 20) {
            return {
              html: clone.innerHTML,
              text: cleanText
            }
          }
        }
      }
    } catch (_) {}
  }

  // 2. 启发式：寻找正文段落与文字密度最高的容器元素
  try {
    const candidates = Array.from(document.querySelectorAll("div, section, article"))
    let bestEl: HTMLElement | null = null
    let maxScore = 0
    for (const el of candidates) {
      if (el.closest("nav, header, footer, aside, .sidebar, .comments")) continue
      const textLen = ((el as HTMLElement).innerText || "").trim().length
      if (textLen < 50) continue
      const pCount = el.querySelectorAll("p").length
      const score = textLen + pCount * 100
      if (score > maxScore) {
        maxScore = score
        bestEl = el as HTMLElement
      }
    }
    if (bestEl && maxScore > 200) {
      const clone = bestEl.cloneNode(true) as HTMLElement
      cleanElement(clone)
      return {
        html: clone.innerHTML,
        text: (clone.innerText || clone.textContent || "").trim()
      }
    }
  } catch (_) {}

  // 3. 降级：使用 body 的副本，移除已知非内容块
  const body = document.body || document.documentElement
  if (body) {
    const clone = body.cloneNode(true) as HTMLElement
    cleanElement(clone)
    return {
      html: clone.innerHTML,
      text: (clone.innerText || clone.textContent || "").trim()
    }
  }

  return { html: "", text: "" }
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
  const article = extractArticle()

  return {
    title: document.title || "未命名网页",
    url: window.location.href,
    description: getMeta(["description", "og:description", "twitter:description"]),
    author: getMeta(["author", "article:author", "twitter:creator"]),
    siteName: getMeta(["og:site_name", "application-name"]) || window.location.hostname,
    favicon: faviconEl ? faviconEl.href : `${window.location.origin}/favicon.ico`,
    selectedText: selection.text,
    selectedHtml: selection.html,
    articleHtml: article.html,
    articleText: article.text,
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
