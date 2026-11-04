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
let editedMarkdown: string | null = null
let previousTemplate = "default"
let pageReady = false
const templateSelect = document.getElementById("clip-template") as HTMLSelectElement
const templateBody = document.getElementById("template-body") as HTMLTextAreaElement
const authorInput = document.getElementById("clip-author") as HTMLInputElement
const siteInput = document.getElementById("clip-site") as HTMLInputElement
const sourceInput = document.getElementById("clip-source") as HTMLInputElement
const quoteTemplate = "# {{title}}\n\n> 来源：[{{site}}]({{url}}) · {{date}}\n\n{{content}}\n\n## 我的笔记\n\n{{notes}}"
const defaultTemplate = "# {{title}}\n\n[原文]({{url}}) · {{author}} · {{date}}\n\n{{content}}\n\n## 阅读笔记\n\n{{notes}}"
let preferencesReady = false
async function preferences(action: "read" | "write") {
  try {
    const storage = typeof chrome !== "undefined" ? chrome.storage?.local : undefined
    if (action === "read") {
      const saved = storage ? (await storage.get("clipperPreferences")).clipperPreferences : JSON.parse(localStorage.getItem("clipperPreferences") || "null")
      if (saved && typeof saved === "object") {
        if (typeof saved.folder === "string") folderInput!.value = saved.folder
        if (typeof saved.tags === "string") tagsInput!.value = saved.tags
        if (["default", "quote", "custom"].includes(saved.template)) templateSelect.value = saved.template
        if (typeof saved.body === "string") templateBody.value = saved.body
      }
    } else {
      const saved = { folder: folderInput?.value, tags: tagsInput?.value, template: templateSelect.value, body: templateBody.value }
      if (storage) await storage.set({ clipperPreferences: saved })
      else localStorage.setItem("clipperPreferences", JSON.stringify(saved))
    }
  } catch { /* 剪藏仍可使用，不因偏好存储不可用而阻断。 */ }
}
function updateTemplateSettings() {
  document.getElementById("template-settings")!.hidden = templateSelect.value !== "custom"
}


// DOM 元素
const titleInput = document.getElementById("clip-title") as HTMLInputElement | null
const folderInput = document.getElementById("clip-folder") as HTMLInputElement | null
const tagsInput = document.getElementById("clip-tags") as HTMLInputElement | null
const notesInput = document.getElementById("clip-notes") as HTMLTextAreaElement | null
const previewEl = document.getElementById("preview-content") as HTMLTextAreaElement | null
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
      title: titleInput?.value || currentMeta.title,
      author: authorInput.value, siteName: siteInput.value
    },
    currentMode,
    tags,
    notes,
    templateSelect.value === "custom" ? templateBody.value : templateSelect.value === "quote" ? quoteTemplate : undefined
  )
  document.getElementById("edit-state")!.hidden = editedMarkdown === null
  const content = editedMarkdown ?? md
  if (previewEl) previewEl.value = content
  document.getElementById("content-count")!.textContent = String(content.length)
  if (preferencesReady) void preferences("write")
  return content
}

/** Sets mode. */
function setMode(mode: ClipMode) {
  if (mode === "selection" && !currentMeta.selectedText?.trim() && !currentMeta.selectedHtml?.trim()) {
    showMessage("请先在网页中选择需要摘录的内容，再打开剪藏。", "error")
    return
  }
  if (mode !== currentMode && editedMarkdown !== null && !window.confirm("切换模式将重新生成正文，是否继续？")) return
  if (mode === currentMode) return
  editedMarkdown = null
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

templateBody.value = defaultTemplate
previewEl?.addEventListener("input", () => { editedMarkdown = previewEl.value; document.getElementById("edit-state")!.hidden = false; document.getElementById("content-count")!.textContent = String(previewEl.value.length) })
document.getElementById("reset-content")?.addEventListener("click", () => {
  if (editedMarkdown !== null && !window.confirm("重新生成将覆盖手动修改，是否继续？")) return
  editedMarkdown = null; updateMarkdownPreview()
})
templateSelect.addEventListener("change", () => {
  if (editedMarkdown !== null && !window.confirm("应用模板将覆盖手动修改，是否继续？")) {
    templateSelect.value = previousTemplate
    return
  }
  previousTemplate = templateSelect.value
  updateTemplateSettings()
  editedMarkdown = null
  updateMarkdownPreview()
})
for (const input of [authorInput, siteInput, templateBody, folderInput]) input?.addEventListener("input", updateMarkdownPreview)
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
  if (!saveBtn || !pageReady) return
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
      author: authorInput.value,
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
    if (new URLSearchParams(location.search).get("vesselHost") !== "1" && !("vesselPageBridge" in window)) throw new Error("Use the active browser tab")
    const res = await fetch("http://127.0.0.1:35678/api/active-page", { signal: AbortSignal.timeout(2000) })
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
    authorInput.value = currentMeta.author || ""
    siteInput.value = currentMeta.siteName || ""
    sourceInput.value = currentMeta.url
    if (titleInput && currentMeta.title) {
      titleInput.value = currentMeta.title
    }
    if (currentMeta.selectedText && currentMeta.selectedText.trim()) {
      setMode("selection")
    } else {
      setMode("article")
    }
  }

  pageReady = Boolean(pageMetadata?.url)
  if (!pageReady) showMessage("未能读取当前网页，请刷新网页后重新打开剪藏。", "error")
  if (saveBtn) saveBtn.disabled = !pageReady
  if (copyBtn) copyBtn.disabled = !pageReady
  if (downloadBtn) downloadBtn.disabled = !pageReady
  updateMarkdownPreview()
}

/** Initializes init. */
async function init() {
  await preferences("read")
  previousTemplate = templateSelect.value
  preferencesReady = true
  updateTemplateSettings()
  // 先更新一次基础 Markdown 预览
  updateMarkdownPreview()

  const pageLoading = loadActivePageData()
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

  // 页面提取与连接检测互不阻塞。
  await pageLoading
}

// 启动初始化
void init()
