import { checkVesselStatus, saveClipToVessel, downloadMarkdownFile, copyTextToClipboard } from "../client.js"
import { buildClipMarkdown } from "../parser.js"
import type { PageMetadata, ClipMode } from "../types"

let currentMeta: PageMetadata = {
  title: "网页剪藏",
  url: "",
  timestamp: new Date().toISOString()
}

let currentMode: ClipMode = "article"
let isVesselConnected = false

// DOM 元素
const titleInput = document.getElementById("clip-title") as HTMLInputElement | null
const folderInput = document.getElementById("clip-folder") as HTMLInputElement | null
const tagsInput = document.getElementById("clip-tags") as HTMLInputElement | null
const notesInput = document.getElementById("clip-notes") as HTMLTextAreaElement | null
const previewEl = document.getElementById("preview-content") as HTMLPreElement | null
const togglePreviewBtn = document.getElementById("toggle-preview-btn") as HTMLButtonElement | null
const statusBadge = document.getElementById("connection-status") as HTMLDivElement | null
const statusText = statusBadge?.querySelector(".text") as HTMLSpanElement | null
const messageBar = document.getElementById("message-bar") as HTMLDivElement | null
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement | null
const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement | null
const copyBtn = document.getElementById("copy-btn") as HTMLButtonElement | null
const tabBtns = document.querySelectorAll(".tab-btn")

function showMessage(text: string, type: "success" | "error" = "success") {
  if (!messageBar) return
  messageBar.textContent = text
  messageBar.className = `message-bar ${type}`
  setTimeout(() => {
    if (messageBar) messageBar.className = "message-bar"
  }, 4000)
}

function updateMarkdownPreview() {
  const tags = (tagsInput?.value || "")
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  const notes = notesInput?.value || ""
  const md = buildClipMarkdown(
    {
      ...currentMeta,
      title: titleInput?.value || currentMeta.title
    },
    currentMode,
    tags,
    notes
  )
  if (previewEl) previewEl.textContent = md
  return md
}

function setMode(mode: ClipMode) {
  currentMode = mode
  tabBtns.forEach((btn) => {
    if ((btn as HTMLElement).dataset.mode === mode) {
      btn.classList.add("active")
    } else {
      btn.classList.remove("active")
    }
  })
  updateMarkdownPreview()
}

// 绑定 Tab 切换
tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const mode = (btn as HTMLElement).dataset.mode as ClipMode
    if (mode) setMode(mode)
  })
})

// 字段变化时更新预览
titleInput?.addEventListener("input", updateMarkdownPreview)
tagsInput?.addEventListener("input", updateMarkdownPreview)
notesInput?.addEventListener("input", updateMarkdownPreview)

// 预览折叠切换
togglePreviewBtn?.addEventListener("click", () => {
  if (!previewEl || !togglePreviewBtn) return
  const isHidden = previewEl.classList.contains("hidden")
  if (isHidden) {
    previewEl.classList.remove("hidden")
    togglePreviewBtn.classList.add("open")
  } else {
    previewEl.classList.add("hidden")
    togglePreviewBtn.classList.remove("open")
  }
})

// 复制
copyBtn?.addEventListener("click", async () => {
  const md = updateMarkdownPreview()
  const success = await copyTextToClipboard(md)
  if (success) {
    showMessage("已复制 Markdown 内容至剪贴板", "success")
  } else {
    showMessage("复制失败", "error")
  }
})

// 下载
downloadBtn?.addEventListener("click", () => {
  const md = updateMarkdownPreview()
  const rawTitle = titleInput?.value || currentMeta.title || "clip"
  const cleanTitle = rawTitle.replace(/[\\/:*?"<>|]/g, "-").trim()
  downloadMarkdownFile(`${cleanTitle}.md`, md)
  showMessage("已开始下载 Markdown 文件", "success")
})

// 保存到 Vessel
saveBtn?.addEventListener("click", async () => {
  if (!saveBtn) return
  const md = updateMarkdownPreview()
  const tags = (tagsInput?.value || "")
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  saveBtn.disabled = true
  saveBtn.textContent = "保存中..."

  try {
    const res = await saveClipToVessel({
      title: titleInput?.value || currentMeta.title,
      url: currentMeta.url,
      markdown: md,
      tags,
      folder: folderInput?.value || "Clippings",
      description: currentMeta.description,
      author: currentMeta.author,
      mode: currentMode
    })

    if (res.ok && res.success) {
      showMessage(`✅ 保存成功: ${res.relativePath || res.filename || ""}`, "success")
    } else {
      const errMsg = res.message || res.error || "保存失败，请检查桌面端状态"
      showMessage(`❌ ${errMsg}`, "error")
    }
  } catch (err) {
    showMessage(`保存失败: ${String(err)}`, "error")
  } finally {
    saveBtn.disabled = false
    saveBtn.textContent = "保存到 Vessel"
  }
})

async function loadActivePageData() {
  let pageMetadata: PageMetadata | null = null

  // A. 独立 Chrome 浏览器环境检测：检查是否有真实的 active tab
  try {
    if (typeof chrome !== "undefined" && chrome.tabs?.query) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [] as chrome.tabs.Tab[])
      const activeTab = tabs[0]
      if (activeTab && activeTab.id && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
        // 尝试向 content script 发送消息
        try {
          const resp = await chrome.tabs.sendMessage<any, PageMetadata>(activeTab.id, { type: "GET_PAGE_DATA" }).catch(() => null)
          if (resp && (resp.articleHtml || resp.selectedText || resp.url)) {
            pageMetadata = resp
          }
        } catch {}

        // 若 content script 未注入，使用 scripting.executeScript 动态提取
        if (!pageMetadata && chrome.scripting?.executeScript) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              func: () => {
                const sel = window.getSelection()
                const text = sel ? sel.toString().trim() : ""
                let selHtml = ""
                if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                  const div = document.createElement("div")
                  div.appendChild(sel.getRangeAt(0).cloneContents())
                  selHtml = div.innerHTML
                }

                const selectors = [
                  "#js_content", ".Post-RichText", ".RichContent-inner",
                  "#content_views", ".article_content", ".article-viewer",
                  ".markdown-body", ".article-holder", ".article-content",
                  "article", "main", "[role='main']",
                  ".post-content", ".article-content", ".entry-content",
                  "#article-root", "#content", ".article", ".post_body", ".post-body"
                ]
                let artHtml = ""
                for (const s of selectors) {
                  const el = document.querySelector(s)
                  if (el && ((el as HTMLElement).innerText || el.textContent || "").trim().length > 20) {
                    artHtml = el.innerHTML
                    break
                  }
                }
                if (!artHtml) {
                  const body = document.body || document.documentElement
                  if (body) {
                    const clone = body.cloneNode(true) as HTMLElement
                    const removeSelectors = ["script", "style", "noscript", "iframe", "nav", "header", "footer", "aside", ".sidebar", ".comments", ".ad"]
                    removeSelectors.forEach(s => { clone.querySelectorAll(s).forEach(n => n.remove()) })
                    artHtml = clone.innerHTML
                  }
                }

                const getMeta = (names: string[]) => {
                  for (const n of names) {
                    const m = document.querySelector(`meta[name='${n}'], meta[property='${n}']`)
                    if (m) {
                      const v = m.getAttribute("content")
                      if (v) return v.trim()
                    }
                  }
                  return ""
                }

                return {
                  title: document.title || "未命名网页",
                  url: window.location.href,
                  description: getMeta(["description", "og:description", "twitter:description"]),
                  author: getMeta(["author", "article:author", "twitter:creator"]),
                  siteName: getMeta(["og:site_name", "application-name"]) || window.location.hostname,
                  selectedText: text,
                  selectedHtml: selHtml,
                  articleHtml: artHtml,
                  timestamp: new Date().toISOString()
                }
              }
            })
            if (results && results[0]?.result) {
              pageMetadata = results[0].result as PageMetadata
            }
          } catch (scriptErr) {
            console.warn("executeScript fallback error:", scriptErr)
          }
        }
      }
    }
  } catch (chromeErr) {
    console.warn("Chrome tab query error:", chromeErr)
  }

  // B. Vessel 内置浏览器环境（或 Chrome 环境未获取成功时）：向 Vessel Bridge 获取当前活动页面
  if (!pageMetadata || !pageMetadata.articleHtml) {
    try {
      const res = await fetch("http://127.0.0.1:35678/api/active-page")
      if (res.ok) {
        const json = await res.json()
        const data = json.data || json
        if (data && data.url) {
          pageMetadata = {
            title: data.title || pageMetadata?.title || "未命名网页",
            url: data.url || pageMetadata?.url || "",
            description: data.description || pageMetadata?.description || "",
            author: data.author || pageMetadata?.author || "",
            siteName: data.siteName || pageMetadata?.siteName || "",
            favicon: data.favicon || pageMetadata?.favicon || "",
            articleHtml: data.articleHtml || pageMetadata?.articleHtml || "",
            selectedText: data.selectedText || pageMetadata?.selectedText || "",
            selectedHtml: data.selectedHtml || pageMetadata?.selectedHtml || "",
            timestamp: data.timestamp || new Date().toISOString()
          }
        }
      }
    } catch (bridgeErr) {
      console.warn("Vessel bridge fetch error:", bridgeErr)
    }
  }

  if (pageMetadata) {
    currentMeta = pageMetadata
    if (titleInput && currentMeta.title) {
      titleInput.value = currentMeta.title
    }
    if (currentMeta.selectedText && currentMeta.selectedText.trim()) {
      setMode("selection")
    } else {
      setMode("article")
    }
  }

  updateMarkdownPreview()
}

async function init() {
  // 先更新一次基础 Markdown 预览
  updateMarkdownPreview()

  // 1. 检查 Vessel 连接状态
  try {
    const status = await checkVesselStatus()
    if (status && status.ok) {
      isVesselConnected = true
      if (statusBadge) statusBadge.className = "status-badge connected"
      const wsName = status.workspace?.name ? `已连接: ${status.workspace.name}` : "已连接 Vessel"
      if (statusText) statusText.textContent = wsName
    } else {
      isVesselConnected = false
      if (statusBadge) statusBadge.className = "status-badge disconnected"
      if (statusText) statusText.textContent = "未连接桌面端"
    }
  } catch (err) {
    console.error("Vessel check error:", err)
    isVesselConnected = false
    if (statusBadge) statusBadge.className = "status-badge disconnected"
    if (statusText) statusText.textContent = "未连接桌面端"
  }

  // 2. 加载当前网页数据
  await loadActivePageData()
}

// 启动初始化
void init()
