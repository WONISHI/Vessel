import { restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { buildMarkdownLink, normalizeLinkUrl } from "@vessel/obsidian"
import { useEffect, useRef, useState } from "react"
import type { VditorEditorState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-vditor-editor-state"

/** 链接插入浮层：状态、目标高亮与确认逻辑 */
export function useLinkTooltip(state: VditorEditorState) {
  const { readOnly, instance, host, properties, changeHandler } = state

  const [linkTooltip, setLinkTooltip] = useState<{
    anchor: { left: number; top: number; width?: number; height?: number }
    initialUrl?: string
    initialText?: string
    targetElement?: HTMLElement | null
    range?: Range
  } | null>(null)
  useEffect(() => {
    const range = linkTooltip?.range
    if (!range || range.collapsed || typeof Highlight === "undefined" || !CSS.highlights) return
    // Keep the target visible after focus moves into the URL field, without editing document DOM.
    const name = "vessel-link-target"
    const highlight = new Highlight(range)
    CSS.highlights.set(name, highlight)
    return () => { if (CSS.highlights.get(name) === highlight) CSS.highlights.delete(name) }
  }, [linkTooltip])

  useEffect(() => {
    const target = linkTooltip?.targetElement
    if (!target) return
    target.classList.add("vessel-link-edit-target")
    return () => target.classList.remove("vessel-link-edit-target")
  }, [linkTooltip])

  const triggerInsertLinkRef = useRef<(customRange?: Range, anchor?: { left: number; top: number; width?: number; height?: number }) => void>(() => {})

  const triggerInsertLink = (customRange?: Range, clickAnchor?: { left: number; top: number; width?: number; height?: number }) => {
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

    let anchorRect: { left: number; top: number; width?: number; height?: number } | null = clickAnchor ?? null
    if (range && !clickAnchor) {
      const rect = range.getBoundingClientRect?.()
      if (rect && rect.bottom > 0 && rect.top < window.innerHeight && (rect.width > 0 || rect.height > 0)) {
        anchorRect = {
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 24),
          height: Math.max(rect.height, 22)
        }
      }
    }

    const existingLinks = new Set(editable.querySelectorAll('[data-type="a"]'))
    instance.current.insertValue(selectedText ? `[${selectedText}](https://)` : "[](https://)", true)
    const targetElement = Array.from(editable.querySelectorAll<HTMLElement>('[data-type="a"]')).find((node) => !existingLinks.has(node)) ?? null
    if (targetElement) {
      // Keep the Markdown placeholder visible while the URL input owns focus.
      targetElement.classList.add("vessel-link-edit-target")
      const rect = targetElement.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < window.innerHeight && rect.height > 0) anchorRect = rect
    }
    changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(instance.current.getValue()))
    const edRect = editable.getBoundingClientRect()
    setLinkTooltip({
      anchor: anchorRect || { left: edRect.left + 24, top: edRect.top + 24, width: 32, height: 22 },
      initialUrl: "https://",
      initialText: selectedText,
      targetElement,
      range: range?.cloneRange()
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
      const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
      const range = linkTooltip?.range
      if (!editable || !range || !editable.contains(range.commonAncestorContainer)) { setLinkTooltip(null); return }
      editable.focus({ preventScroll: true })
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
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
            const linkTextSpan = lastLink.querySelector<HTMLElement>(".vditor-ir__link")
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

  return { linkTooltip, setLinkTooltip, triggerInsertLinkRef, triggerInsertLink, handleConfirmLink }
}

export type LinkTooltipState = ReturnType<typeof useLinkTooltip>
