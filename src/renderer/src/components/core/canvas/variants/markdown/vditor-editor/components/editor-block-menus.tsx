import { CalloutBlockMenu } from "@/components/core/canvas/variants/markdown/callout-block-menu"
import { CalloutTypeMenu } from "@/components/core/canvas/variants/markdown/callout-type-menu"
import { changeCalloutType } from "@/components/core/canvas/variants/markdown/callouts"
import { FootnoteHoverCard } from "@/components/core/canvas/variants/markdown/footnote-hover-card"
import { insertFootnote, validFootnoteRange, deleteFootnote } from "@/components/core/canvas/variants/markdown/footnotes"
import { FootnotePopover } from "@/components/core/canvas/variants/markdown/footnote-popover"
import { MarkdownInsertMenu } from "@/components/core/canvas/variants/markdown/insert-menu"
import { insertEmptyCodeBlock } from "@/components/core/canvas/variants/markdown/insert-code-block"
import { focusImageParagraph, focusInsideQuote } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { toast } from "sonner"
import type { VditorEditorModel } from "@/components/core/canvas/variants/markdown/vditor-editor/types"

/** 脚注、Callout 与插入菜单浮层 */
export function EditorBlockMenus({ m }: { m: VditorEditorModel }) {
  const { documentPath, readOnly, footnoteTarget, setFootnoteTarget, insertLocation, setInsertLocation, clipboardImageInsertAction, imageInsertAction, instance, calloutBlockMenu, setCalloutBlockMenu, calloutMenu, setCalloutMenu, host, properties, initialValue, changeHandler, triggerInsertLinkRef } = m

  return (
    <>
      <FootnoteHoverCard host={host} source={() => restoreObsidianImages(instance.current?.getValue() || initialValue.current)} onDelete={readOnly ? undefined : (id) => {
        if (instance.current && host.current && deleteFootnote(instance.current, host.current, id)) changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(instance.current.getValue()))
      }} />
      {footnoteTarget && !readOnly && footnoteTarget.path === documentPath && (
        <FootnotePopover
          text={footnoteTarget.text}
          range={footnoteTarget.range}
          onCancel={(restoreSelection = true) => {
            const range = footnoteTarget.range
            if (restoreSelection && host.current && validFootnoteRange(host.current, range)) {
              host.current.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')?.focus({ preventScroll: true })
              const selection = window.getSelection()
              selection?.removeAllRanges()
              selection?.addRange(range)
            }
            setFootnoteTarget(null)
          }}
          onInsert={(content) => {
            if (!instance.current || !host.current || !insertFootnote(instance.current, host.current, footnoteTarget.range, footnoteTarget.text, content)) {
              toast.error("选区已变化，请重新选中文字后添加脚注")
              setFootnoteTarget(null)
              return
            }
            changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(instance.current.getValue()))
            setFootnoteTarget(null)
          }}
        />
      )}
      {calloutBlockMenu && !readOnly && (
        <CalloutBlockMenu x={calloutBlockMenu.x} y={calloutBlockMenu.y} onClose={() => setCalloutBlockMenu(null)} onFocus={(below) => {
          const editor = instance.current, quote = calloutBlockMenu.quote
          if (!editor || !host.current?.contains(quote)) return
          editor.vditor.undo?.addToUndoStack(editor.vditor)
          // 标注/callout: empty lines go inside the quote, not as siblings outside it.
          focusInsideQuote(quote, below)?.scrollIntoView({ block: "nearest" })
          editor.vditor.undo?.addToUndoStack(editor.vditor)
          changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(editor.getValue()))
          setCalloutBlockMenu(null)
        }} onCopy={() => {
          const quote = calloutBlockMenu.quote, editor = instance.current
          if (editor && host.current?.contains(quote)) {
            const source = restoreObsidianImages(editor.vditor.lute.VditorIRDOM2Md(quote.outerHTML))
            void navigator.clipboard.writeText(source).then(() => toast.success("已复制标注")).catch((error) => toast.error(String(error)))
          }
          setCalloutBlockMenu(null)
        }} onDelete={() => {
          const editor = instance.current, quote = calloutBlockMenu.quote
          if (!editor || !host.current?.contains(quote)) return
          editor.vditor.undo?.addToUndoStack(editor.vditor)
          focusImageParagraph(quote, true)
          quote.remove()
          editor.vditor.undo?.addToUndoStack(editor.vditor)
          changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(editor.getValue()))
          setCalloutBlockMenu(null)
        }} />
      )}
      {calloutMenu && !readOnly && (
        <CalloutTypeMenu x={calloutMenu.x} y={calloutMenu.y} currentType={calloutMenu.quote.dataset.calloutType} onClose={() => setCalloutMenu(null)} onSelect={(name) => {
          const editor = instance.current
          if (editor && host.current?.contains(calloutMenu.quote)) {
            editor.vditor.undo?.addToUndoStack(editor.vditor)
            if (changeCalloutType(calloutMenu.quote, name)) {
              editor.vditor.undo?.addToUndoStack(editor.vditor)
              changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(editor.getValue()))
            }
          }
          setCalloutMenu(null)
        }} />
      )}
      {insertLocation && !readOnly && (
        <MarkdownInsertMenu
          preserveEditorFocus={insertLocation.slash}
          x={insertLocation.x}
          y={insertLocation.y}
          onClose={() => setInsertLocation(null)}
          onInsert={(value, inline) => {
            const range = insertLocation.range
            const editable = host.current?.querySelector<HTMLElement>('.vditor-ir [contenteditable="true"]')
            if (value === "link") {
              // Let Radix finish closing/focus restoration before opening another input layer.
              setInsertLocation(null)
              requestAnimationFrame(() => {
                if (!editable || !instance.current) return
                const saved = editable.contains(range.commonAncestorContainer) ? range : document.createRange()
                if (saved !== range) { saved.selectNodeContents(editable); saved.collapse(false) }
                if (saved.toString() === "/" || saved.toString() === "、") saved.deleteContents()
                triggerInsertLinkRef.current(saved, { left: insertLocation.x, top: insertLocation.y, width: 24, height: 20 })
              })
              return
            }
            if (!editable?.contains(range.commonAncestorContainer) || !instance.current) return
            editable.focus({ preventScroll: true })
            const selection = window.getSelection()
            selection?.removeAllRanges()
            selection?.addRange(range)
            if (range.toString() === "/" || range.toString() === "、") {
              range.deleteContents()
            }
            if (value === "image-clipboard") clipboardImageInsertAction.current?.()
            else if (value === "image") imageInsertAction.current?.()
            else if (value === "code-block") insertEmptyCodeBlock(instance.current, editable)
            else if (value === "***") instance.current.insertMD("\n\n***\n\n")
            else instance.current.insertValue(inline ? value : `\n\n${value}\n\n`, true)
            setInsertLocation(null)
          }}
        />
      )}
    </>
  )
}
