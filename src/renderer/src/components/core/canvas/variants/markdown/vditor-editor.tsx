import { markdownDocuments, printableMarkdown } from "@/components/native-file-menu/document-bridge"
import { MarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu"
import { bindMarkdownInsertMenu, type MarkdownInsertLocation } from "@/components/core/canvas/variants/markdown/insert-menu-selection"
import { CodeBlockContextMenu } from "@/components/core/canvas/variants/markdown/code-block-context-menu"
import { CodeLanguageDialog } from "@/components/core/canvas/variants/markdown/code-language-dialog"
import { insertEmptyCodeBlock } from "@/components/core/canvas/variants/markdown/insert-code-block"
import { changeCodeLanguage } from "@/components/core/canvas/variants/markdown/change-code-language"
import { bindTaskCheckboxes } from "@/components/core/canvas/variants/markdown/task-checkboxes"
import { renderSteps, escapeStepsText } from "@vessel/markdown-steps"
import "@vessel/markdown-steps/style.css"
import { MarkdownTableEditor } from "@vessel/markdown-table"
import "@vessel/markdown-table/style.css"
import { bindListShortcuts } from "@/components/core/canvas/variants/markdown/list-shortcuts"
import { bindImageParagraphs, focusImageParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"
import "@/components/core/canvas/variants/markdown/index.css"
import { clearCodeHighlights, decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"
import { decorateMarkdownTags } from "@/components/core/canvas/variants/markdown/decorate-tags"
import { decorateKeyboardShortcuts } from "@/components/core/canvas/variants/markdown/decorate-kbd"
import { decorateHighlights } from "@/components/core/canvas/variants/markdown/decorate-highlights"
import { bindWikiLinkEditing, decorateWikiLinks } from "@/components/core/canvas/variants/markdown/decorate-wiki-links"
import { DocumentProperties } from "@/components/core/canvas/variants/markdown/document-properties"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { decorateInlineHTML } from "@/components/core/canvas/variants/markdown/inline-html"
import { ObsidianImageLine } from "@/components/core/canvas/variants/markdown/obsidian-images"
import { bindTableActions } from "@/components/core/canvas/variants/markdown/table-actions"
import { bindTablePaste } from "@/components/core/canvas/variants/markdown/table-paste"
import { TextColors } from "@/components/core/canvas/variants/markdown/text-colors"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { LinkInteractionArea } from "@/components/ui/link"
import { PageLoading } from "@/components/ui/page-loading"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Typography } from "@/components/ui/typography"
import { parseFrontmatter } from "@vessel/obsidian/frontmatter"
import { LinkTooltip, buildMarkdownLink, normalizeLinkUrl } from "@vessel/obsidian"
import "@vessel/obsidian/links/style.css"
import { markdownHotkey } from "@vessel/utils"
import { Bold, Code, CodeXml, Heading, ImagePlus, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Minus, Palette, Quote, Redo2, Smile, Strikethrough, Table2, Undo2 } from "lucide-react"
import { Fragment, useEffect, useRef, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { toast } from "sonner"
import Vditor from "vditor"
import "vditor/dist/index.css"

/** 保留 Vditor 编辑能力，文档显示和大纲由外层 React 组件负责。 */
export function VditorEditor({ value, onChange, workspacePath, documentPath, readOnly = false }: { readOnly?: boolean; workspacePath: string; documentPath: string; value: string; onChange: (value: string) => void }) {
  const [insertLocation, setInsertLocation] = useState<MarkdownInsertLocation | null>(null)
  const imageInsertAction = useRef<(() => void) | null>(null)
  const [languageBlock, setLanguageBlock] = useState<HTMLElement | null>(null)
  const [codeContextMenu, setCodeContextMenu] = useState<{ block: HTMLElement; x: number; y: number } | null>(null)
  const [colorAnchor, setColorAnchor] = useState<{ left: number; top: number } | null>(null)
  const colorRange = useRef<Range | null>(null)
  const instance = useRef<Vditor | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const host = useRef<HTMLDivElement>(null)
  const toolbarHost = useRef<HTMLDivElement>(null)
  const [properties] = useState(() => parseFrontmatter(value))
  const initialValue = useRef(properties?.body ?? value)
  const changeHandler = useRef(onChange)
  const [linkTooltip, setLinkTooltip] = useState<{
    anchor: { left: number; top: number; width?: number; height?: number }
    initialUrl?: string
    initialText?: string
    targetElement?: HTMLElement | null
  } | null>(null)
  const triggerInsertLinkRef = useRef<(customRange?: Range) => void>(() => {})

  const triggerInsertLink = (customRange?: Range) => {
    if (readOnly || !instance.current) return
    const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
    if (!editable) return

    editable.focus({ preventScroll: true })
    const selection = window.getSelection()
    if (customRange) {
      selection?.removeAllRanges()
      selection?.addRange(customRange)
    }

    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    const selectedText = range ? range.toString() : ""

    let anchorRect: { left: number; top: number; width?: number; height?: number } | null = null
    if (range) {
      const rect = range.getBoundingClientRect()
      if (rect.top > 0 || rect.left > 0) {
        anchorRect = {
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 24),
          height: Math.max(rect.height, 22)
        }
      }
    }

    instance.current.insertValue(selectedText ? `[${selectedText}](https://)` : "[](https://)", true)

    requestAnimationFrame(() => {
      const sel = window.getSelection()
      const activeRange = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null
      let linkEl: HTMLElement | null = null

      if (activeRange) {
        const container = activeRange.startContainer
        linkEl = (container instanceof HTMLElement ? container : container.parentElement)?.closest<HTMLElement>('[data-type="a"]') || null
      }

      if (!linkEl) {
        const allLinks = editable.querySelectorAll<HTMLElement>('[data-type="a"]')
        if (allLinks.length > 0) {
          linkEl = allLinks[allLinks.length - 1]
        }
      }

      if (linkEl) {
        const rect = linkEl.getBoundingClientRect()
        if (rect.top > 0 || rect.left > 0) {
          anchorRect = {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height
          }
        }
      }

      if (!anchorRect) {
        const edRect = editable.getBoundingClientRect()
        anchorRect = {
          left: edRect.left + 24,
          top: edRect.top + 24,
          width: 32,
          height: 22
        }
      }

      setLinkTooltip({
        anchor: anchorRect,
        initialUrl: "https://",
        initialText: selectedText,
        targetElement: linkEl
      })
    })
  }
  triggerInsertLinkRef.current = triggerInsertLink

  const handleConfirmLink = (url: string) => {
    if (!instance.current) {
      setLinkTooltip(null)
      return
    }

    const normalized = normalizeLinkUrl(url)
    const targetEl = linkTooltip?.targetElement
    const selectedText = linkTooltip?.initialText || ""
    const updatedMd = buildMarkdownLink(selectedText, normalized)

    if (targetEl && targetEl.isConnected) {
      const range = document.createRange()
      range.selectNode(targetEl)
      range.deleteContents()
      range.collapse(true)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
      instance.current.insertValue(updatedMd, true)
    } else {
      instance.current.insertValue(updatedMd, true)
    }

    if (!selectedText) {
      requestAnimationFrame(() => {
        const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
        const sel = window.getSelection()
        if (editable && sel) {
          const links = editable.querySelectorAll<HTMLElement>('[data-type="a"]')
          const lastLink = links.length > 0 ? links[links.length - 1] : null
          if (lastLink) {
            const linkTextSpan = lastLink.querySelector<HTMLElement>('.vditor-ir__link')
            if (linkTextSpan) {
              const r = document.createRange()
              r.selectNodeContents(linkTextSpan)
              r.collapse(true)
              sel.removeAllRanges()
              sel.addRange(r)
            }
          }
        }
      })
    }

    const next = instance.current.getValue()
    changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
    setLinkTooltip(null)
  }

  useEffect(() => {
    changeHandler.current = onChange
  }, [onChange])
  useEffect(() => {
    if (!host.current) return
    const element = host.current

    /** Performs the remember selection operation. */
    const rememberSelection = () => {
      const selection = window.getSelection()
      if (selection?.rangeCount && !selection.isCollapsed && element.contains(selection.anchorNode) && element.contains(selection.focusNode)) colorRange.current = selection.getRangeAt(0).cloneRange()
    }
    const toolbarContainer = toolbarHost.current
    toolbarContainer?.addEventListener("pointerdown", rememberSelection, true)
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === "k" || event.key === "K")) {
        event.preventDefault()
        event.stopPropagation()
        triggerInsertLinkRef.current()
      }
    }
    element.addEventListener("keydown", handleKeyDown, true)
    const unbindInsertMenu = readOnly ? () => {} : bindMarkdownInsertMenu(element, setInsertLocation, () => setInsertLocation(null))
    const unbindTablePaste = readOnly ? () => {} : bindTablePaste(element)
    const unbindImageParagraphs = readOnly ? () => {} : bindImageParagraphs(element)
    const unbindListShortcuts = readOnly ? () => {} : bindListShortcuts(element)
    const unbindTaskCheckboxes = bindTaskCheckboxes(element, readOnly)
    const unbindWikiEditing = bindWikiLinkEditing(element)
    const unbindTableActions = readOnly ? () => {} : bindTableActions(element)

    const imageRoots = new Map<HTMLElement, Root>()
    const tableRoots = new Map<HTMLElement, Root>()
    let disposed = false
    let ready = false

    const mountTable = (previewElement: HTMLElement) => {
      const block = previewElement.closest<HTMLElement>("[data-type=code-block]")
      if (!block) return
      block.classList.add("vessel-table-block")
      block.classList.remove("vessel-direct-code")

      if (previewElement.querySelector(".vessel-table-container")) return

      const code = previewElement.querySelector("code") || block.querySelector("pre.vditor-ir__marker code")
      const source = code?.textContent || ""

      const container = document.createElement("div")
      container.className = "vessel-table-container"
      container.contentEditable = "false"
      container.addEventListener("mousedown", (event) => event.stopPropagation())
      container.addEventListener("click", (event) => event.stopPropagation())
      container.addEventListener("mouseup", (event) => event.stopPropagation())
      previewElement.replaceChildren(container)

      for (const [node, root] of tableRoots) {
        if (!node.isConnected) {
          queueMicrotask(() => root.unmount())
          tableRoots.delete(node)
        }
      }

      const root = createRoot(container)
      tableRoots.set(container, root)

      const renderTable = (currentSource: string) => root.render(
        <MarkdownTableEditor
          readOnly={readOnly}
          source={currentSource}
          onChange={(updated) => {
            if (readOnly) return
            const sourceCode = block.querySelector("pre.vditor-ir__marker code")
            if (!sourceCode) return
            editor?.vditor?.undo?.addToUndoStack(editor.vditor)
            sourceCode.textContent = updated + "\n"
            const next = editor?.getValue() || ""
            renderTable(updated)
            editor?.vditor?.undo?.addToUndoStack(editor.vditor)
            changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
          }}
          onFocusAbove={() => {
            const editable = block.closest<HTMLElement>('[contenteditable="true"]')
            if (!editable || readOnly) return
            focusImageParagraph(block, false)?.scrollIntoView({ block: "nearest" })
          }}
          onFocusBelow={() => {
            const editable = block.closest<HTMLElement>('[contenteditable="true"]')
            if (!editable || readOnly) return
            focusImageParagraph(block)?.scrollIntoView({ block: "nearest" })
          }}
          onCopy={() => {
            const sourceCode = block.querySelector("pre.vditor-ir__marker code")
            const textToCopy = sourceCode?.textContent?.trim() || currentSource || ""
            if (textToCopy) {
              void navigator.clipboard?.writeText(textToCopy)
              toast.success("已复制表格数据")
            }
          }}
          onDelete={() => {
            if (readOnly) return
            editor?.vditor?.undo?.addToUndoStack(editor.vditor)
            block.remove()
            const next = editor?.getValue() || ""
            editor?.vditor?.undo?.addToUndoStack(editor.vditor)
            changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
            tableRoots.delete(container)
            queueMicrotask(() => root.unmount())
          }}
        />
      )
      renderTable(source)
    }

    /** Performs the decorate operation. */
    const decorate = () => {
      decorateCodeBlocks(element, readOnly)
      element.querySelectorAll<HTMLElement>('[data-type="code-block"]').forEach((block) => {
        const markerCode = block.querySelector<HTMLElement>("pre.vditor-ir__marker code")
        const isTable = markerCode && Array.from(markerCode.classList).some((cls) => cls.includes("language-markdown-table"))
        if (isTable) {
          block.classList.add("vessel-table-block")
          block.classList.remove("vessel-direct-code")
          const preview = block.querySelector<HTMLElement>(".vditor-ir__preview")
          if (preview && !preview.querySelector(".vessel-table-container")) {
            mountTable(preview)
          }
        }
      })
      const content = element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      if (content) {
        decorateHighlights(content)
        decorateWikiLinks(content)
        decorateInlineHTML(content)
        if (readOnly || !content.contains(document.activeElement)) decorateMarkdownTags(content)
        decorateKeyboardShortcuts(content)
        if (readOnly)
          content.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
            input.disabled = true
          })
      }
    }

    /** Performs the choose language operation. */
    const chooseLanguage = (event: Event) => setLanguageBlock((event as CustomEvent<HTMLElement>).detail)
    element.addEventListener("vessel-code-language", chooseLanguage)
    const handleCodeContextMenu = (event: Event) => setCodeContextMenu((event as CustomEvent<{ block: HTMLElement; x: number; y: number }>).detail)
    element.addEventListener("vessel-code-context-menu", handleCodeContextMenu)
    element.addEventListener("focusout", decorate)
    const observer = new MutationObserver(decorate)
    observer.observe(element, { childList: true, subtree: true })
    const imagePicker = document.createElement("input")
    imageInsertAction.current = () => imagePicker.click()
    imagePicker.type = "file"
    imagePicker.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif,image/bmp"
    imagePicker.addEventListener("change", () => {
      const file = imagePicker.files?.[0]
      if (!file || !/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file.name)) return
      const path = window.electronAPI.getDroppedFilePath(file)
      void (path
        ? window.electronAPI.saveObsidianImage(workspacePath, documentPath, { path })
        : file.arrayBuffer().then((bytes) => window.electronAPI.saveObsidianImage(workspacePath, documentPath, { bytes: new Uint8Array(bytes) })))
        .then((saved) => {
          if (disposed) return
          editor.insertMD(prepareObsidianImages(saved.reference))
          refreshImages()
        })
        .catch((error) => toast.error(String(error)))
      imagePicker.value = ""
    })
    let editor: Vditor
    let imageFrame = 0

    /** Refreshes images. */
    const refreshImages = () => {
      cancelAnimationFrame(imageFrame)
      imageFrame = requestAnimationFrame(() => {
        if (disposed) return
        const value = editor.getValue()
        // insertMD already renders the prepared image block; preserve the rest of the editor DOM.
        decorate()
        changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(value))
      })
    }

    /** Pastes image. */
    const pasteImage = (event: ClipboardEvent) => {
      if (readOnly || !ready || !event.clipboardData) return
      const selection = getSelection()
      const anchor = selection?.anchorNode
      const parent = anchor instanceof Element ? anchor : anchor?.parentElement
      if (parent?.closest('[data-type="code-block"], code')) return
      const file = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"))
      if (file) {
        event.preventDefault()
        event.stopImmediatePropagation()
        const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
        void file
          .arrayBuffer()
          .then((bytes) => window.electronAPI.saveObsidianImage(workspacePath, documentPath, { bytes: new Uint8Array(bytes) }))
          .then((saved) => {
            if (disposed) return
            element.querySelector<HTMLElement>('[contenteditable="true"]')?.focus()
            if (range && element.contains(range.commonAncestorContainer)) {
              selection?.removeAllRanges()
              selection?.addRange(range)
            }
            editor.insertMD(prepareObsidianImages(saved.reference))
            refreshImages()
          })
          .catch((error) => toast.error(String(error)))
      } else {
        const text = event.clipboardData.getData("text/plain")
        const prepared = prepareObsidianImages(text)
        if (prepared !== text) {
          event.preventDefault()
          event.stopImmediatePropagation()
          editor.insertMD(prepared)
          refreshImages()
        }
      }
    }
    element.addEventListener("paste", pasteImage, true)
    let initFrame = 0
    let paintFrame = 0
    const timeout = setTimeout(() => {
      if (!disposed && !ready) setLoadError("编辑器加载超时，请重新打开文档。")
    }, 45000)

    /** Initializes initialize. */
    const initialize = () => {
      if (disposed) return
      try {
        editor = new Vditor(element, {
          cdn: new URL("./vendor/vditor", document.baseURI).href,
          lang: "zh_CN",
          theme: "classic",
          image: { isPreview: false },
          // Language selection is handled by our explicit toolbar picker, not Vditor autocomplete.
          preview: { hljs: { style: "atom-one-light", langs: [] }, math: { engine: "KaTeX" } },
          icon: "ant",
          height: "auto",
          value: prepareObsidianImages(initialValue.current),
          customRenders: [
            ...(["steps", "timeline"] as const).map((language) => ({
              language,
              /** Renders list-based diagrams while leaving Vditor's source node intact. */
              render: (preview: HTMLElement) => {
                const code = preview.querySelector(`code.language-${language}`)
                if (!code) return
                const source = code.textContent || ""
                try { preview.innerHTML = renderSteps(source, language) }
                catch (error) { preview.innerHTML = `<div role="alert">${escapeStepsText(String(error))}</div><pre>${escapeStepsText(source)}</pre>` }
              }
            })),
            {
              language: "vessel-obsidian-image",

              /** Renders the current view. */
              render: (element) => {
                const code = element.querySelector("code.language-vessel-obsidian-image")
                if (!code) return
                let source: string
                try {
                  source = decodeURIComponent(code.textContent?.trim() || "")
                } catch {
                  return
                }
                element.closest("[data-type=code-block]")?.classList.add("vessel-image-block")
                const container = document.createElement("div")
                container.contentEditable = "false"
                container.addEventListener("mousedown", (event) => {
                  event.stopPropagation()
                  if ((event.target as HTMLElement).closest("img")) event.preventDefault()
                })
                container.addEventListener("click", (event) => event.stopPropagation())
                container.addEventListener("mouseup", (event) => event.stopPropagation())
                element.replaceChildren(container)
                for (const [node, root] of imageRoots) {
                  if (!node.isConnected) {
                    queueMicrotask(() => root.unmount())
                    imageRoots.delete(node)
                  }
                }
                const root = createRoot(container)
                imageRoots.set(container, root)
                /** Updates only this React image root, retaining the surrounding editor DOM. */
                const renderImage = (currentSource: string) => root.render(
                  <ObsidianImageLine
                    onFocusAbove={() => {
                      const block = element.closest<HTMLElement>("[data-type=code-block]")
                      const editable = block?.closest<HTMLElement>('[contenteditable="true"]')
                      if (!block || !editable || readOnly) return
                      focusImageParagraph(block, false)?.scrollIntoView({ block: "nearest" })
                    }}
                    onFocusBelow={() => {
                      const block = element.closest<HTMLElement>("[data-type=code-block]")
                      const editable = block?.closest<HTMLElement>('[contenteditable="true"]')
                      if (!block || !editable || readOnly) return
                      focusImageParagraph(block)?.scrollIntoView({ block: "nearest" })
                    }}
                    readOnly={readOnly}
                    source={currentSource}
                    onChange={(updated) => {
                      if (readOnly) return
                      const block = element.closest<HTMLElement>("[data-type=code-block]")
                      const sourceCode = block?.querySelector("pre.vditor-ir__marker code")
                      if (!sourceCode) return
                      editor.vditor.undo?.addToUndoStack(editor.vditor)
                      if (!updated.trim()) {
                        block?.remove()
                        const next = editor.getValue()
                        editor.vditor.undo?.addToUndoStack(editor.vditor)
                        changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
                        imageRoots.delete(container)
                        queueMicrotask(() => root.unmount())
                        return
                      }
                      sourceCode.textContent = encodeURIComponent(updated) + "\n"
                      const next = editor.getValue()
                      renderImage(updated)
                      editor.vditor.undo?.addToUndoStack(editor.vditor)
                      changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
                    }}
                    root={workspacePath}
                    documentPath={documentPath}
                  />
                )
                renderImage(source)
              }
            },
            {
              language: "markdown-table",
              render: (element) => mountTable(element)
            }
          ],
          cache: { enable: false },
          outline: { enable: false, position: "right" },
          typewriterMode: false,
          mode: "ir",
          toolbarConfig: { pin: true },
          // 内联 SVG 避免 hash 路由下的 sprite 引用和异步图标脚本加载问题。
          toolbar: readOnly
            ? []
            : [
                { name: "headings", hotkey: markdownHotkey("headings"), icon: renderToStaticMarkup(<Heading />) },
                { name: "bold", hotkey: markdownHotkey("bold"), icon: renderToStaticMarkup(<Bold />) },
                { name: "italic", hotkey: markdownHotkey("italic"), icon: renderToStaticMarkup(<Italic />) },
                { name: "strike", hotkey: markdownHotkey("strike"), icon: renderToStaticMarkup(<Strikethrough />) },
                {
                  name: "text-colors",
                  tip: "文字颜色与背景色",
                  icon: renderToStaticMarkup(<Palette />),

                  /** Performs the click operation. */
                  click: () => {
                    if (!colorRange.current || colorRange.current.collapsed) return
                    const rect = toolbarHost.current?.querySelector('[data-type="text-colors"]')?.getBoundingClientRect()
                    if (rect) setColorAnchor({ left: rect.left, top: rect.bottom + 8 })
                  }
                },
                "|",
                { name: "link", hotkey: markdownHotkey("link"), icon: renderToStaticMarkup(<LinkIcon />) },
                {
                  name: "insert-image",
                  tip: "插入图片",
                  icon: renderToStaticMarkup(<ImagePlus />),

                  /** Performs the click operation. */
                  click: () => imagePicker.click()
                },
                { name: "emoji", hotkey: markdownHotkey("emoji"), icon: renderToStaticMarkup(<Smile />) },
                { name: "list", hotkey: markdownHotkey("list"), icon: renderToStaticMarkup(<List />) },
                { name: "ordered-list", hotkey: markdownHotkey("ordered-list"), icon: renderToStaticMarkup(<ListOrdered />) },
                { name: "check", hotkey: markdownHotkey("check"), icon: renderToStaticMarkup(<ListChecks />) },
                "|",
                { name: "quote", hotkey: markdownHotkey("quote"), icon: renderToStaticMarkup(<Quote />) },
                { name: "code", hotkey: markdownHotkey("code"), icon: renderToStaticMarkup(<Code />) },
                { name: "inline-code", hotkey: markdownHotkey("inline-code"), icon: renderToStaticMarkup(<CodeXml />) },
                { name: "table", hotkey: markdownHotkey("table"), icon: renderToStaticMarkup(<Table2 />) },
                { name: "line", hotkey: markdownHotkey("line"), icon: renderToStaticMarkup(<Minus />) },
                "|",
                { name: "undo", hotkey: markdownHotkey("undo"), icon: renderToStaticMarkup(<Undo2 />) },
                { name: "redo", hotkey: markdownHotkey("redo"), icon: renderToStaticMarkup(<Redo2 />) }
              ].map((item) => (typeof item === "string" ? item : { ...item, tipPosition: "s" })),

          /** Performs the input operation. */
          input: (content) => {
            if (!disposed && !readOnly) {
              changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(content))
              const prepared = prepareObsidianImages(content)
              cancelAnimationFrame(imageFrame)
              if (prepared !== content)
                imageFrame = requestAnimationFrame(() => {
                  if (disposed) return
                  const scroller = element.querySelector(".vditor-ir"),
                    top = scroller?.scrollTop || 0
                  editor.setValue(prepareObsidianImages(editor.getValue()))
                  if (scroller) scroller.scrollTop = top
                })
            }
          },

          /** Performs the after operation. */
          after: () => {
            instance.current = editor
            if (!readOnly) markdownDocuments.set(documentPath, {
              content: () => (properties?.raw ?? "") + restoreObsidianImages(editor.getValue()),
              html: () => printableMarkdown(element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")!)
            })
            window.dispatchEvent(new Event("vessel:file-menu-refresh"))
            const toolbar = host.current?.querySelector<HTMLElement>(".vditor-toolbar")
            if (!disposed && toolbar && toolbarHost.current) toolbarHost.current.appendChild(toolbar)
            const linkBtn = toolbar?.querySelector<HTMLElement>('[data-type="link"]')
            const handleLinkBtnClick = (event: Event) => {
              event.preventDefault()
              event.stopPropagation()
              triggerInsertLinkRef.current()
            }
            linkBtn?.addEventListener("click", handleLinkBtnClick, true)
            toolbar?.querySelectorAll<HTMLElement>('button[data-tag^="h"]').forEach((button, index) => {
              button.parentElement?.classList.add("vessel-heading-menu")
              button.textContent = ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"][index]
              button.dataset.level = `H${index + 1}`
              button.dataset.shortcut = /Mac/.test(navigator.platform) ? `⌥⌘${index + 1}` : `Alt+Ctrl+${index + 1}`
            })
            if (readOnly && !disposed) editor.disabled()
            decorate()
            ready = true
            clearTimeout(timeout)
            if (disposed) editor.destroy()
            else
              paintFrame = requestAnimationFrame(() => {
                if (!disposed) {
                  setLoading(false)
                  setLoadError("")
                }
              })
          }
        })
      } catch (error) {
        clearTimeout(timeout)
        if (!disposed) setLoadError(String(error))
      }
    }
    // 先绘制占位图，再开始同步解析，避免首帧白屏。
    initFrame = requestAnimationFrame(() => {
      initFrame = requestAnimationFrame(initialize)
    })
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(initFrame)
      cancelAnimationFrame(paintFrame)
      imageRoots.forEach((root) => queueMicrotask(() => root.unmount()))
      tableRoots.forEach((root) => queueMicrotask(() => root.unmount()))
      observer.disconnect()
      clearCodeHighlights(element)
      instance.current = null
      if (!readOnly) markdownDocuments.delete(documentPath)
      window.dispatchEvent(new Event("vessel:file-menu-refresh"))
      element.removeEventListener("keydown", handleKeyDown, true)
      toolbarContainer?.removeEventListener("pointerdown", rememberSelection, true)
      unbindWikiEditing()
      unbindTableActions()
      unbindInsertMenu()
      imageInsertAction.current = null
      unbindTablePaste()
      unbindImageParagraphs()
      unbindListShortcuts()
      unbindTaskCheckboxes()
      element.removeEventListener("focusout", decorate)
      element.removeEventListener("vessel-code-language", chooseLanguage)
      element.removeEventListener("vessel-code-context-menu", handleCodeContextMenu)
      element.removeEventListener("paste", pasteImage, true)
      cancelAnimationFrame(imageFrame)
      disposed = true
      if (ready) editor.destroy()
      toolbarHost.current?.replaceChildren()
    }
  }, [properties, readOnly])
  return (
    <LinkInteractionArea className="relative flex h-full min-h-0 min-w-0 flex-col">
      {insertLocation && !readOnly && (
        <MarkdownInsertMenu
          preserveEditorFocus={insertLocation.slash}
          x={insertLocation.x}
          y={insertLocation.y}
          onClose={() => setInsertLocation(null)}
          onInsert={(value, inline) => {
            const range = insertLocation.range
            const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
            if (!editable?.contains(range.commonAncestorContainer) || !instance.current) return
            editable.focus({ preventScroll: true })
            const selection = window.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(range)
            if (range.toString() === "/" || range.toString() === "、") {
              range.deleteContents()
            }
            if (value === "image") imageInsertAction.current?.()
            else if (value === "link") triggerInsertLink(range)
            else if (value === "code-block") insertEmptyCodeBlock(instance.current, editable)
            else instance.current.insertValue(inline ? value : `\n\n${value}\n\n`, true)
            setInsertLocation(null)
          }}
        />
      )}
      {languageBlock && (
        <CodeLanguageDialog
          anchor={languageBlock}
          value={languageBlock.querySelector("pre code")?.className.match(/language-([^\s]+)/)?.[1] || "text"}
          onClose={() => setLanguageBlock(null)}
          onConfirm={(language) => {
            if (instance.current && !readOnly) changeCodeLanguage(instance.current, languageBlock, language)
            setLanguageBlock(null)
          }}
        />
      )}
      {codeContextMenu && (
        <CodeBlockContextMenu
          x={codeContextMenu.x}
          y={codeContextMenu.y}
          readOnly={readOnly}
          onClose={() => setCodeContextMenu(null)}
          onFocusAbove={() => {
            const { block } = codeContextMenu
            const editable = block.closest<HTMLElement>('[contenteditable="true"]')
            if (!editable || readOnly) return
            focusImageParagraph(block, false)?.scrollIntoView({ block: "nearest" })
          }}
          onFocusBelow={() => {
            const { block } = codeContextMenu
            const editable = block.closest<HTMLElement>('[contenteditable="true"]')
            if (!editable || readOnly) return
            focusImageParagraph(block, true)?.scrollIntoView({ block: "nearest" })
          }}
          onCopy={() => {
            const { block } = codeContextMenu
            const codeEl = block.querySelector<HTMLElement>("pre.vditor-ir__marker code, pre.vditor-ir__preview code, code")
            const textToCopy = codeEl?.textContent || ""
            void navigator.clipboard?.writeText(textToCopy)
            toast.success("已复制代码内容")
          }}
          onDelete={() => {
            if (readOnly || !instance.current) return
            const { block } = codeContextMenu
            instance.current.vditor.undo?.addToUndoStack(instance.current.vditor)
            block.remove()
            const next = instance.current.getValue()
            instance.current.vditor.undo?.addToUndoStack(instance.current.vditor)
            changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
            toast.success("已删除代码块")
          }}
        />
      )}
      {colorAnchor && (
        <TextColors
          anchor={colorAnchor}
          onClose={() => setColorAnchor(null)}
          onApply={(color, background) => {
            const range = colorRange.current
            if (!range || !host.current?.contains(range.commonAncestorContainer) || !instance.current) {
              setColorAnchor(null)
              return
            }
            const text = range.toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            const selection = window.getSelection()
            host.current.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')?.focus({ preventScroll: true })
            selection?.removeAllRanges()
            selection?.addRange(range)
            if (color === null) {
              let wrapper = (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest<HTMLElement>("[data-vessel-inline-html]")
              while (wrapper && wrapper.dataset.vesselInlineTag !== (background ? "mark" : "font")) wrapper = wrapper.parentElement?.closest<HTMLElement>("[data-vessel-inline-html]") || null
              if (wrapper) {
                const opening = wrapper.previousSibling,
                  closing = wrapper.nextSibling
                if (opening && closing) {
                  const before = range.cloneRange()
                  before.selectNodeContents(wrapper)
                  before.setEnd(range.startContainer, range.startOffset)
                  const after = range.cloneRange()
                  after.selectNodeContents(wrapper)
                  after.setStart(range.endContainer, range.endOffset)

                  /** Escapes escape. */
                  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                  const start = (opening as HTMLElement).querySelector("code")?.textContent || ""
                  const end = (closing as HTMLElement).querySelector("code")?.textContent || ""
                  const prefix = before.toString(),
                    suffix = after.toString()
                  range.setStartBefore(opening)
                  range.setEndAfter(closing)
                  selection?.removeAllRanges()
                  selection?.addRange(range)
                  instance.current.insertMD((prefix ? start + escape(prefix) + end : "") + text + (suffix ? start + escape(suffix) + end : ""))
                }
              }
            } else instance.current.insertMD(background ? `<mark style="background:${color}">${text}</mark>` : `<font color="${color}">${text}</font>`)
            const content = host.current.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
            if (content) decorateInlineHTML(content)
            setColorAnchor(null)
          }}
        />
      )}
      {(loading || loadError) && (
        <div className="absolute inset-0 z-30 bg-white">
          {loadError ? (
            <p
              role="alert"
              className="p-6 text-sm text-red-600"
            >
              {loadError}
            </p>
          ) : (
            <PageLoading label="正在解析 Markdown 文档…" />
          )}
        </div>
      )}
      {linkTooltip && !readOnly && (
        <LinkTooltip
          anchor={linkTooltip.anchor}
          initialUrl={linkTooltip.initialUrl}
          initialText={linkTooltip.initialText}
          onConfirm={handleConfirmLink}
          onClose={() => {
            setLinkTooltip(null)
            const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
            editable?.focus({ preventScroll: true })
          }}
          onOpenUrl={(url) => window.open(url, "_blank")}
        />
      )}
      {!readOnly && (
        <Breadcrumb
          className="shrink-0 px-4 pt-2"
          aria-label="当前文件路径"
        >
          <BreadcrumbList className="text-xs">
            {(() => {
              const normWorkspace = workspacePath.replace(/\\/g, "/")
              const normDoc = documentPath.replace(/\\/g, "/")
              const rootName = normWorkspace.split("/").filter(Boolean).pop() || "工作区"
              const segments = [{ name: rootName, path: workspacePath }]
              if (normWorkspace && normDoc.startsWith(normWorkspace)) {
                const rel = normDoc.slice(normWorkspace.length).replace(/^\/+/, "")
                let accumulated = normWorkspace
                for (const part of rel.split("/").filter(Boolean)) {
                  accumulated += "/" + part
                  segments.push({ name: part, path: accumulated })
                }
              }
              return segments.map((segment, index, parts) => {
                const isLast = index === parts.length - 1
                return (
                  <Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="min-w-0">
                      {isLast ? (
                        <BreadcrumbPage
                          className="cursor-pointer truncate rounded-md px-1.5 py-0.5 max-w-64 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
                          onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: segment.path }))}
                        >
                          {segment.name}
                        </BreadcrumbPage>
                      ) : (
                        <span
                          className="cursor-pointer truncate rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
                          onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: segment.path }))}
                        >
                          {segment.name}
                        </span>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                )
              })
            })()}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div
        ref={toolbarHost}
        className={readOnly ? "hidden" : "vessel-vditor shrink-0 min-w-0 w-full"}
      />
      <ScrollArea className="vessel-editor-scroll flex-1 min-h-0 min-w-0 mt-2">
        {properties && (
          <DocumentProperties
            properties={properties.properties}
            workspacePath={workspacePath}
          />
        )}
        <Typography asChild>
          <div
            ref={host}
            className="vessel-vditor min-h-full"
          />
        </Typography>
      </ScrollArea>
    </LinkInteractionArea>
  )
}
