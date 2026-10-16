import { saveClipToVessel } from "#vessel-clipper/client"
import { buildClipMarkdown } from "#vessel-clipper/parser"
import type { PageMetadata } from "#vessel-clipper/types"

// 仅在宿主环境支持 chrome.contextMenus 时注册右键上下文菜单（如独立 Chrome / Chromium 浏览器）
const contextMenus = typeof chrome !== "undefined" ? (chrome as any).contextMenus : undefined

if (contextMenus && typeof contextMenus.create === "function" && contextMenus.onClicked) {
  try {
    chrome.runtime?.onInstalled?.addListener(() => {
      try {
        contextMenus.removeAll?.(() => {
          contextMenus.create({
            id: "vessel-clip-page",
            title: "剪藏整个网页到 Vessel",
            contexts: ["page"]
          })

          contextMenus.create({
            id: "vessel-clip-selection",
            title: "剪藏选中文本到 Vessel",
            contexts: ["selection"]
          })

          contextMenus.create({
            id: "vessel-clip-link",
            title: "剪藏链接到 Vessel",
            contexts: ["link"]
          })
        })
      } catch {}
    })

    // 处理右键菜单点击
    contextMenus.onClicked.addListener(async (info: any, tab: any) => {
      if (!tab || !tab.id || !tab.url) return

      let meta: PageMetadata = {
        title: tab.title || "未命名网页",
        url: tab.url,
        timestamp: new Date().toISOString()
      }

      // 尝试从页面 content script 获取更全面的元数据
      try {
        const pageData = await chrome.tabs?.sendMessage<any, PageMetadata>(tab.id, { type: "GET_PAGE_DATA" })
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

      const action = typeof chrome !== "undefined" ? (chrome as any).action : undefined
      if (action && typeof action.setBadgeText === "function") {
        if (res.ok) {
          await action.setBadgeText({ text: "✓", tabId: tab.id })
          await action.setBadgeBackgroundColor?.({ color: "#16a34a", tabId: tab.id })
          setTimeout(() => {
            void action.setBadgeText?.({ text: "", tabId: tab.id })
          }, 2500)
        } else {
          await action.setBadgeText({ text: "!", tabId: tab.id })
          await action.setBadgeBackgroundColor?.({ color: "#dc2626", tabId: tab.id })
          setTimeout(() => {
            void action.setBadgeText?.({ text: "", tabId: tab.id })
          }, 3000)
        }
      }
    })
  } catch (err) {
    console.warn("[Clipper Background] Failed to setup contextMenus:", err)
  }
}
