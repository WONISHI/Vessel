import { CodeBlockContextMenu } from "@/components/core/canvas/variants/markdown/code-block-context-menu"
import { CodeLanguageDialog } from "@/components/core/canvas/variants/markdown/code-language-dialog"
import { changeCodeLanguage } from "@/components/core/canvas/variants/markdown/change-code-language"
import { focusImageParagraph } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { decorateInlineHTML } from "@/components/core/canvas/variants/markdown/inline-html"
import { TextColors } from "@/components/core/canvas/variants/markdown/text-colors"
import { toast } from "sonner"
import type { VditorEditorModel } from "@/components/core/canvas/variants/markdown/vditor-editor/types"

/** 代码块语言、代码块右键菜单与文字颜色浮层 */
export function EditorCodeMenus({ m }: { m: VditorEditorModel }) {
  const { readOnly, languageBlock, setLanguageBlock, codeContextMenu, setCodeContextMenu, colorAnchor, setColorAnchor, colorRange, instance, host, properties, changeHandler } = m

  return (
    <>
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
    </>
  )
}
