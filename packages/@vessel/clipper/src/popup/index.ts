import { checkVesselStatus, copyTextToClipboard, downloadMarkdownFile, saveClipToVessel } from "#vessel-clipper/client"
import { buildClipMarkdown } from "#vessel-clipper/parser"
import type { ClipMode, PageMetadata } from "#vessel-clipper/types"

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

/** Shows message. */
function showMessage(text: string, type: "success" | "error" = "success") {
  if (!messageBar) return
  messageBar.textContent = text
  messageBar.className = `message-bar ${type}`
  setTimeout(() => {
    if (messageBar) messageBar.className = "message-bar"
  }, 4000)
}

/** Updates markdown preview. */
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

/** Sets mode. */
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

/** Loads active page data. */
async function loadActivePageData() {
  let pageMetadata: PageMetadata | null = null

  // 1. 优先尝试从 Vessel Bridge 获取当前活动页面（在 Vessel 桌面端内时极速获取）
  try {
    const res = await fetch("http://127.0.0.1:35678/api/active-page")
    if (res.ok) {
      const json = await res.json()
      const data = json.data || json
      if (data && (data.url || data.title)) {
        pageMetadata = {
          title: data.title || "未命名网页",
          url: data.url || "",
          description: data.description || "",
          author: data.author || "",
          siteName: data.siteName || "",
          favicon: data.favicon || "",
          articleHtml: data.articleHtml || "",
          articleText: data.articleText || "",
          selectedText: data.selectedText || "",
          selectedHtml: data.selectedHtml || "",
          timestamp: data.timestamp || new Date().toISOString()
        }
      }
    }
  } catch (bridgeErr) {
    // Vessel Bridge 未连接或不可用，继续降级到 Chrome 扩展 API
  }

  // 2. 如果未从 Bridge 获取到正文，且存在 Chrome 扩展环境，尝试 Chrome Tabs 与 Scripting API
  if (!pageMetadata || (!pageMetadata.articleHtml && !pageMetadata.articleText && !pageMetadata.selectedText)) {
    try {
      if (typeof chrome !== "undefined" && chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [] as chrome.tabs.Tab[])
        const activeTab = tabs[0]
        if (activeTab && activeTab.id && activeTab.url && /^https?:\/\//i.test(activeTab.url)) {
          // 尝试向 content script 发送消息
          try {
            const resp = await chrome.tabs.sendMessage<any, PageMetadata>(activeTab.id, { type: "GET_PAGE_DATA" }).catch(() => null)
            if (resp && (resp.articleHtml || resp.articleText || resp.selectedText || resp.url)) {
              pageMetadata = resp
            }
          } catch {}

          // 若 content script 未注入，使用 scripting.executeScript 动态提取
          if (!pageMetadata && chrome.scripting?.executeScript) {
            try {
              const results = await chrome.scripting.executeScript({
                target: { tabId: activeTab.id },

                /** Performs the func operation. */
                func: () => {
                  const sel = window.getSelection()
                  const text = sel ? sel.toString().trim() : ""
                  let selHtml = ""
                  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                    const div = document.createElement("div")
                    div.appendChild(sel.getRangeAt(0).cloneContents())
                    selHtml = div.innerHTML
                  }

                  /** Performs the clean operation. */
                  function clean(el: HTMLElement) {
                    const junk = ["script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "aside", ".sidebar", ".comments", ".ad"]
                    junk.forEach((s) => {
                      el.querySelectorAll(s).forEach((n) => n.remove())
                    })
                  }

                  const selectors = [
                    "#js_content",
                    ".Post-RichText",
                    ".RichContent-inner",
                    "#content_views",
                    ".article_content",
                    ".article-viewer",
                    ".markdown-body",
                    ".article-holder",
                    ".article-content",
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
                  let artHtml = ""
                  let artText = ""
                  for (const s of selectors) {
                    const el = document.querySelector(s) as HTMLElement
                    if (el && (el.innerText || el.textContent || "").trim().length > 20) {
                      const clone = el.cloneNode(true) as HTMLElement
                      clean(clone)
                      artHtml = clone.innerHTML
                      artText = (clone.innerText || "").trim()
                      break
                    }
                  }
                  if (!artHtml) {
                    const body = document.body || document.documentElement
                    if (body) {
                      const clone = body.cloneNode(true) as HTMLElement
                      clean(clone)
                      artHtml = clone.innerHTML
                      artText = (clone.innerText || "").trim()
                    }
                  }

                  /** Returns meta. */
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
                    articleText: artText,
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

/** Initializes init. */
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
