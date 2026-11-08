import { useState } from "react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu"
import { MarkdownContextMenuAnchor } from "./context-menu-anchor"
import { canCopyHeadingBlock, headingBlockRange } from "./heading-handles"
import type Vditor from "vditor"
import { restoreObsidianImages } from "./image-source"
import { toast } from "sonner"

/** Actions operate on a heading and all content up to the next peer or parent heading. */
export function HeadingBlockMenu({ heading, x, y, editor, onClose }: { heading: HTMLElement; x: number; y: number; editor: Vditor; onClose: () => void }) {
  const [copyEnabled] = useState(() => canCopyHeadingBlock(heading))
  const focusHeading = (atEnd: boolean) => {
    const editable = heading.closest<HTMLElement>('[contenteditable="true"]')
    if (!editable) return
    const block = headingBlockRange(heading)
    if (!block) return
    let boundary: Element = heading
    if (atEnd) {
      const last = block.endContainer.childNodes[block.endOffset - 1]
      if (last instanceof Element) boundary = last
    }
    let target = atEnd ? boundary.nextElementSibling : heading.previousElementSibling
    if (!(target instanceof HTMLElement) || target.tagName !== "P" || target.textContent?.trim()) {
      editor.vditor.undo?.addToUndoStack(editor.vditor)
      target = document.createElement("p")
      target.append(document.createElement("br"))
      if (atEnd) boundary.after(target)
      else heading.before(target)
      editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }))
    }
    editable.focus({ preventScroll: true })
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    target.scrollIntoView({ block: "nearest" })
  }
  const folded = heading.classList.contains("vessel-heading-folded")
  return (
    <ContextMenu modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <MarkdownContextMenuAnchor x={x} y={y} label="标题块操作" />
      <ContextMenuContent className="w-36" onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuItem disabled={!copyEnabled} onSelect={() => {
          if (!copyEnabled) return
          const range = headingBlockRange(heading)
          if (!range) return
          const container = document.createElement("div")
          container.append(range.cloneContents())
          const markdown = restoreObsidianImages(editor.vditor.lute.VditorIRDOM2Md(container.innerHTML))
          void navigator.clipboard.writeText(markdown).catch((error) => toast.error(String(error)))
        }}>复制</ContextMenuItem>
        <ContextMenuItem className="text-red-600" onSelect={() => {
          const range = headingBlockRange(heading)
          const editable = heading.closest<HTMLElement>('[contenteditable="true"]')
          if (!range || !editable) return
          editable.focus({ preventScroll: true })
          const selection = window.getSelection()
          selection?.removeAllRanges()
          selection?.addRange(range)
          editor.vditor.undo?.addToUndoStack(editor.vditor)
          if (!document.execCommand("delete")) {
            range.deleteContents()
            editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }))
          }
        }}>删除</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>更换标题</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            {["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"].map((label, index) => (
              <ContextMenuItem key={label} disabled={heading.tagName === `H${index + 1}`} onSelect={() => {
                const editable = heading.closest<HTMLElement>('[contenteditable="true"]')
                if (!editable || !heading.isConnected) return
                editor.vditor.undo?.addToUndoStack(editor.vditor)
                const replacement = document.createElement(`h${index + 1}`)
                for (const attribute of Array.from(heading.attributes)) replacement.setAttribute(attribute.name, attribute.value)
                replacement.innerHTML = heading.innerHTML
                const marker = replacement.querySelector('[data-type="heading-marker"], .vditor-ir__marker--heading')
                if (marker) marker.textContent = "#".repeat(index + 1) + " "
                heading.replaceWith(replacement)
                editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "formatBlock" }))
              }}>{label}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => heading.dispatchEvent(new CustomEvent("vessel:heading-focus", { bubbles: true, detail: heading }))}>专注</ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>聚焦</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => focusHeading(false)}>在上方聚焦</ContextMenuItem>
            <ContextMenuItem onSelect={() => focusHeading(true)}>在下方聚焦</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={() => {
          heading.classList.toggle("vessel-heading-folded")
          heading.dispatchEvent(new CustomEvent("vessel:heading-fold", { bubbles: true }))
        }}>{folded ? "展开" : "折叠"}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
