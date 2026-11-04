import { restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { buildMarkdownLink } from "@vessel/obsidian"
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

    const selection = window.getSelection()
    const previous = customRange ?? (selection?.rangeCount && editable.contains(selection.getRangeAt(0).commonAncestorContainer) ? selection.getRangeAt(0).cloneRange() : null)
    editable.focus({ preventScroll: true })
    if (previous) {
      selection?.removeAllRanges()
      selection?.addRange(previous)
    }

    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null
    const selectedText = range ? range.toString() : ""

    let anchorRect: { left: number; top: number; width?: number; height?: number } | null = null
    if (range && editable.contains(range.startContainer)) {
      const start = range.cloneRange()
      start.collapse(true)
      const rect = start.getBoundingClientRect?.()
      if (rect && rect.bottom > 0 && rect.top < window.innerHeight && (rect.width > 0 || rect.height > 0)) {
        anchorRect = {
          left: rect.left,
          top: rect.top,
          width: Math.max(rect.width, 24),
          height: Math.max(rect.height, 22)
        }
      }
    }

    // Keep the document unchanged until confirmation: an empty-label placeholder is
    // plain text in Lute and cannot reliably be replaced as a link node later.
    if (!anchorRect && range) {
      const node = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
      const block = node?.closest<HTMLElement>("p,li,h1,h2,h3,h4,h5,h6") ?? editable.children[range.startOffset] as HTMLElement | undefined
      const rect = block?.getBoundingClientRect()
      if (rect && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight) anchorRect = { left: rect.left, top: rect.top, width: 0, height: rect.height }
    }
    const edRect = editable.getBoundingClientRect()
    setLinkTooltip({
      anchor: anchorRect || clickAnchor || { left: edRect.left + 24, top: edRect.top + 24, width: 32, height: 22 },
      initialUrl: "",
      initialText: selectedText,
      targetElement: null,
      range: range?.cloneRange()
    })
  }

  triggerInsertLinkRef.current = triggerInsertLink

  const handleConfirmLink = (url: string) => {
    if (!instance.current) {
      setLinkTooltip(null)
      return
    }

    const destination = url.trim()
    if (!destination) return
    const targetEl = linkTooltip?.targetElement
    const selectedText = linkTooltip?.initialText || ""
    const updatedMd = buildMarkdownLink(selectedText || destination, destination)

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

    const next = instance.current.getValue()
    changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
    setLinkTooltip(null)
  }

  return { linkTooltip, setLinkTooltip, triggerInsertLinkRef, triggerInsertLink, handleConfirmLink }
}

export type LinkTooltipState = ReturnType<typeof useLinkTooltip>
