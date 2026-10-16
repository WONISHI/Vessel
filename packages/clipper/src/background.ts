import { saveClipToVessel } from "./client.js"
import { buildClipMarkdown } from "./parser.js"
import type { PageMetadata } from "./types"

// 安装时注册右键上下文菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "vessel-clip-page",
      title: "剪藏整个网页到 Vessel",
      contexts: ["page"]
    })

    chrome.contextMenus.create({
      id: "vessel-clip-selection",
      title: "剪藏选中文本到 Vessel",
      contexts: ["selection"]
    })

    chrome.contextMenus.create({
      id: "vessel-clip-link",
      title: "剪藏链接到 Vessel",
      contexts: ["link"]
    })
  })
})

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id || !tab.url) return

  let meta: PageMetadata = {
    title: tab.title || "未命名网页",
    url: tab.url,
    timestamp: new Date().toISOString()
  }

  // 尝试从页面 content script 获取更全面的元数据
  try {
    const pageData = await chrome.tabs.sendMessage<any, PageMetadata>(tab.id, { type: "GET_PAGE_DATA" })
    if (pageData) {
      meta = pageData
    }
  } catch {}

  let mode: "article" | "selection" | "bookmark" = "article"

  if (info.menuItemId === "vessel-clip-selection") {
    mode = "selection"
    meta.selectedText = info.selectionText || meta.selectedText
  } else if (info.menuItemId === "vessel-clip-link") {
    mode = "bookmark"
    meta.url = info.linkUrl || meta.url
    meta.title = `链接: ${meta.url}`
  }

  const markdown = buildClipMarkdown(meta, mode, ["快捷剪藏"])

  const res = await saveClipToVessel({
    title: meta.title,
    url: meta.url,
    markdown,
    tags: ["快捷剪藏"],
    folder: "Clippings",
    mode
  })

  if (res.ok) {
    await chrome.action.setBadgeText({ text: "✓", tabId: tab.id })
    await chrome.action.setBadgeBackgroundColor({ color: "#16a34a", tabId: tab.id })
    setTimeout(() => {
      void chrome.action.setBadgeText({ text: "", tabId: tab.id })
    }, 2500)
  } else {
    await chrome.action.setBadgeText({ text: "!", tabId: tab.id })
    await chrome.action.setBadgeBackgroundColor({ color: "#dc2626", tabId: tab.id })
    setTimeout(() => {
      void chrome.action.setBadgeText({ text: "", tabId: tab.id })
    }, 3000)
  }
})
