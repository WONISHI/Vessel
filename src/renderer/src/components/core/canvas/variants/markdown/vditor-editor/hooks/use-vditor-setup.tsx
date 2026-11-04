import { pdfDocumentHtml } from "@/components/pdf-export/export-html"
import { lazyPreviews } from "@/components/core/canvas/variants/markdown/lazy-previews"
import { decorateCallouts, bindCallouts } from "@/components/core/canvas/variants/markdown/callouts"
import { configureBodyLute } from "@/components/core/canvas/variants/markdown/body-lute"
import { bindFootnoteToolbar, decorateFootnoteReferences } from "@/components/core/canvas/variants/markdown/footnotes"
import { markdownDocuments } from "@/components/native-file-menu/document-bridge"
import { bindMarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu-selection"
import { bindTaskCheckboxes } from "@/components/core/canvas/variants/markdown/task-checkboxes"
import { renderSteps, escapeStepsText } from "@vessel/markdown-steps"
import { bindListShortcuts } from "@/components/core/canvas/variants/markdown/list-shortcuts"
import { bindImageParagraphs, insertImageMarkdown } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { clearCodeHighlights, decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"
import { decorateMarkdownTags } from "@/components/core/canvas/variants/markdown/decorate-tags"
import { decorateKeyboardShortcuts } from "@/components/core/canvas/variants/markdown/decorate-kbd"
import { decorateHighlights } from "@/components/core/canvas/variants/markdown/decorate-highlights"
import { bindWikiLinkEditing, decorateWikiLinks } from "@/components/core/canvas/variants/markdown/decorate-wiki-links"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { decorateInlineHTML } from "@/components/core/canvas/variants/markdown/inline-html"
import { bindTableActions } from "@/components/core/canvas/variants/markdown/table-actions"
import { bindTablePaste } from "@/components/core/canvas/variants/markdown/table-paste"
import { clipboardMathMarkdown, normalizeClipboardMath } from "@/components/core/canvas/variants/markdown/math-paste"
import { markdownHotkey } from "@vessel/utils"
import { Bold, Code, CodeXml, Heading, ImagePlus, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Minus, Palette, Quote, Redo2, Smile, Strikethrough, Superscript, Table2, Undo2 } from "lucide-react"
import { useEffect } from "react"
import { type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { toast } from "sonner"
import Vditor from "vditor"
import type { VditorEditorState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-vditor-editor-state"
import type { LinkTooltipState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-link-tooltip"
import { createImageMounter, createTableMounter, type PreviewMountDeps } from "@/components/core/canvas/variants/markdown/vditor-editor/preview-mounts"

/** 创建 Vditor 实例并绑定所有编辑器 DOM 交互（属性或只读状态变化时重建） */
export function useVditorSetup(state: VditorEditorState, { triggerInsertLinkRef }: Pick<LinkTooltipState, "triggerInsertLinkRef">) {
  const { onChange, workspacePath, documentPath, readOnly, tableWorkspace, setFootnoteTarget, setInsertLocation, clipboardImageInsertAction, imageInsertAction, setLanguageBlock, setCodeContextMenu, setColorAnchor, colorRange, instance, setCalloutBlockMenu, setCalloutMenu, setLoading, setLoadError, host, toolbarHost, properties, initialValue, readyHandler, changeHandler } = state

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
    const unbindCallouts = bindCallouts(element, readOnly ? undefined : (target) => { setInsertLocation(null); setCalloutBlockMenu(null); setCalloutMenu(target) }, readOnly ? undefined : (target) => { setInsertLocation(null); setCalloutMenu(null); setCalloutBlockMenu(target) }, (apply) => {
      const current = instance.current
      if (!current || readOnly) return
      current.vditor.undo?.addToUndoStack(current.vditor)
      apply()
      current.vditor.undo?.addToUndoStack(current.vditor)
      changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(current.getValue()))
    })
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
    let unbindFootnotes = () => {}

    const mountDeps: PreviewMountDeps = {
      tableRoots,
      imageRoots,
      workspacePath,
      documentPath,
      tableWorkspace,
      readOnly,
      changeHandler,
      properties,
      getEditor: () => editor,
      mountImage: (preview) => mountImage(preview)
    }
    const mountTable = createTableMounter(mountDeps)

    /** Mount newly inserted image previews without rebuilding the Markdown editor. */
    const mountImageNow = createImageMounter(mountDeps)

    const imagePreviews = lazyPreviews(mountImageNow)
    const mountImage = (preview: HTMLElement) => {
      preview.closest('[data-type="code-block"]')?.classList.add("vessel-image-block")
      imagePreviews.enqueue(preview)
    }

    /** Performs the decorate operation. */
    const decorate = (scope: HTMLElement = element) => {
      if (scope === element) decorateCodeBlocks(element, readOnly)
      scope.querySelectorAll<HTMLElement>('[data-type="code-block"]').forEach((block) => {
        const markerCode = block.querySelector<HTMLElement>("pre.vditor-ir__marker code")
        if (markerCode?.classList.contains("language-vessel-obsidian-image")) {
          const preview = block.querySelector<HTMLElement>(".vditor-ir__preview")
          if (preview) mountImage(preview)
        }
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
      const content = scope === element ? element.querySelector<HTMLElement>(".vditor-ir .vditor-reset") : scope
      if (content) {
        decorateCallouts(content)
        decorateHighlights(content)
        decorateWikiLinks(content)
        decorateInlineHTML(content)
        decorateFootnoteReferences(content)
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
    const handleCodeContextMenu = (event: Event) => { setCalloutBlockMenu(null); setCalloutMenu(null); setCodeContextMenu((event as CustomEvent<{ block: HTMLElement; x: number; y: number }>).detail) }
    element.addEventListener("vessel-code-context-menu", handleCodeContextMenu)
    const onDecorationFocusOut = () => decorate()
    element.addEventListener("focusout", onDecorationFocusOut)
    let decorateFrame = 0
    const dirty = new Set<HTMLElement>()
    let fullDecoration = false
    const observer = new MutationObserver((mutations) => {
      const content = element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      for (const mutation of mutations) {
        let block = mutation.target instanceof HTMLElement ? mutation.target : mutation.target.parentElement
        if (!block || !content?.contains(block)) continue
        if (block.closest(".vessel-table-container, .vessel-image-component, .vessel-image-block .vditor-ir__preview")) continue
        if (block === content) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLElement) dirty.add(node)
            else fullDecoration = true
          }
          continue
        }
        while (block.parentElement && block.parentElement !== content) block = block.parentElement
        dirty.add(block)
      }
      if (decorateFrame || (!dirty.size && !fullDecoration)) return
      decorateFrame = requestAnimationFrame(() => {
        decorateFrame = 0
        if (disposed) return
        observer.disconnect()
        try {
          const blocks = [...dirty].filter((block) => content?.contains(block))
          const isImageSource = (block: HTMLElement) => block.matches('[data-type="code-block"]') && Boolean(block.querySelector('pre.vditor-ir__marker code.language-vessel-obsidian-image'))
          const needsFull = blocks.some((block) => !isImageSource(block) && (block.matches('[data-type="code-block"]') || block.querySelector('[data-type="code-block"]')))
          if (fullDecoration || needsFull) decorate()
          else for (const block of blocks) {
            if (isImageSource(block)) {
              const preview = block.querySelector<HTMLElement>(".vditor-ir__preview")
              if (preview) mountImage(preview)
            } else decorate(block)
          }
        } finally {
          dirty.clear()
          fullDecoration = false
          observer.observe(element, { childList: true, characterData: true, subtree: true })
        }
      })
    })
    observer.observe(element, { childList: true, characterData: true, subtree: true })
    const imagePicker = document.createElement("input")
    clipboardImageInsertAction.current = () => {
      const selection = window.getSelection()
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
      void window.electronAPI.readClipboardImage().then(async (data) => {
        if (!data) { toast.info("剪贴板中没有图片，请先复制一张图片"); return }
        const encoded = data.split(",")[1]
        const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
        const saved = await window.electronAPI.saveObsidianImage(workspacePath, documentPath, { bytes })
        if (disposed) return
        element.querySelector<HTMLElement>('[contenteditable="true"]')?.focus({ preventScroll: true })
        if (range && element.contains(range.commonAncestorContainer)) {
          selection?.removeAllRanges()
          selection?.addRange(range)
        }
        insertImageMarkdown(element, () => editor.insertMD(prepareObsidianImages(saved.reference)))
        refreshImages()
      }).catch((error) => toast.error("读取剪贴板图片失败", { description: String(error) }))
    }
    imageInsertAction.current = () => imagePicker.click()
    imagePicker.type = "file"
    imagePicker.accept = "image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/avif,image/bmp"
    imagePicker.addEventListener("change", () => {
      const file = imagePicker.files?.[0]
      if (!file || !/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file.name)) return
      const path = window.electronAPI.getDroppedFilePath(file)
      void (path ? window.electronAPI.saveObsidianImage(workspacePath, documentPath, { path }) : file.arrayBuffer().then((bytes) => window.electronAPI.saveObsidianImage(workspacePath, documentPath, { bytes: new Uint8Array(bytes) })))
        .then((saved) => {
          if (disposed) return
          insertImageMarkdown(element, () => editor.insertMD(prepareObsidianImages(saved.reference)))
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
            insertImageMarkdown(element, () => editor.insertMD(prepareObsidianImages(saved.reference)))
            refreshImages()
          })
          .catch((error) => toast.error(String(error)))
      } else {
        const mathMarkdown = clipboardMathMarkdown(event.clipboardData.getData("text/html"), (html) => editor.vditor.lute.HTML2Md(html))
        if (mathMarkdown !== null) {
          event.preventDefault()
          event.stopImmediatePropagation()
          editor.insertMD(prepareObsidianImages(mathMarkdown))
          refreshImages()
          return
        }
        const text = event.clipboardData.getData("text/plain")
        const prepared = prepareObsidianImages(normalizeClipboardMath(text))
        if (prepared !== text) {
          event.preventDefault()
          event.stopImmediatePropagation()
          insertImageMarkdown(element, () => editor.insertMD(prepared))
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
          preview: { hljs: { style: "atom-one-light", langs: [] }, math: { engine: "KaTeX", inlineDigit: true } },
          icon: "ant",
          height: "auto",
          // Handle Tab inside the editor instead of moving focus to controls above the document.
          tab: "    ",
          value: prepareObsidianImages(initialValue.current),
          customRenders: [
            ...(["steps", "timeline"] as const).map((language) => ({
              language,
              /** Renders list-based diagrams while leaving Vditor's source node intact. */
              render: (preview: HTMLElement) => {
                const code = preview.querySelector(`code.language-${language}`)
                if (!code) return
                const source = code.textContent || ""
                try {
                  preview.innerHTML = renderSteps(source, language)
                } catch (error) {
                  preview.innerHTML = `<div role="alert">${escapeStepsText(String(error))}</div><pre>${escapeStepsText(source)}</pre>`
                }
              }
            })),
            {
              language: "vessel-obsidian-image",

              render: (preview) => mountImage(preview)
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
                { name: "footnote", tip: "添加脚注", className: "vessel-footnote-tool", icon: renderToStaticMarkup(<Superscript viewBox="2 2 20 20" />), click: () => {} },
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
            configureBodyLute(editor.vditor?.lute)
            // Initial rendering happens before `after`; reparse any leading rule misread as YAML.
            if (element.querySelector('[data-type="yaml-front-matter"]')) editor.setValue(prepareObsidianImages(initialValue.current), true)
            instance.current = editor
            if (!readOnly)
              markdownDocuments.set(documentPath, {
                content: () => (properties?.raw ?? "") + restoreObsidianImages(editor.getValue()),
                html: () => pdfDocumentHtml(element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")!, workspacePath, documentPath)
              })
            window.dispatchEvent(new Event("vessel:file-menu-refresh"))
            const toolbar = host.current?.querySelector<HTMLElement>(".vditor-toolbar")
            if (!disposed && toolbar && toolbarHost.current) toolbarHost.current.appendChild(toolbar)
            if (!readOnly && toolbar) unbindFootnotes = bindFootnoteToolbar(element, toolbar, (range) => setFootnoteTarget({ range, text: range.toString(), path: documentPath }))
            const linkBtn = toolbar?.querySelector<HTMLElement>('[data-type="link"]')
            const handleLinkBtnClick = (event: Event) => {
              event.preventDefault()
              event.stopPropagation()
              triggerInsertLinkRef.current(undefined, linkBtn?.getBoundingClientRect())
            }
            linkBtn?.addEventListener("mousedown", (event) => { event.preventDefault(); event.stopImmediatePropagation() }, true)
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
                  readyHandler.current?.()
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
      imagePreviews.dispose()
      imageRoots.forEach((root) => queueMicrotask(() => root.unmount()))
      tableRoots.forEach((root) => queueMicrotask(() => root.unmount()))
      observer.disconnect()
      cancelAnimationFrame(decorateFrame)
      clearCodeHighlights(element)
      instance.current = null
      if (!readOnly) markdownDocuments.delete(documentPath)
      window.dispatchEvent(new Event("vessel:file-menu-refresh"))
      element.removeEventListener("keydown", handleKeyDown, true)
      toolbarContainer?.removeEventListener("pointerdown", rememberSelection, true)
      unbindFootnotes()
      unbindCallouts()
      unbindWikiEditing()
      unbindTableActions()
      unbindInsertMenu()
      clipboardImageInsertAction.current = null
      imageInsertAction.current = null
      unbindTablePaste()
      unbindImageParagraphs()
      unbindListShortcuts()
      unbindTaskCheckboxes()
      element.removeEventListener("focusout", onDecorationFocusOut)
      element.removeEventListener("vessel-code-language", chooseLanguage)
      element.removeEventListener("vessel-code-context-menu", handleCodeContextMenu)
      element.removeEventListener("paste", pasteImage, true)
      cancelAnimationFrame(imageFrame)
      disposed = true
      if (ready) editor.destroy()
      toolbarHost.current?.replaceChildren()
    }
  }, [properties, readOnly])
}
