import { Copy, Focus, Trash2 } from "lucide-react"
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { MarkdownContextMenuAnchor } from "./context-menu-anchor"
import { headingBlockRange } from "./heading-handles"
import type Vditor from "vditor"
import { restoreObsidianImages } from "./image-source"
import { toast } from "sonner"

/** Actions operate on a heading and all content up to the next peer or parent heading. */
export function HeadingBlockMenu({ heading, x, y, editor, onClose }: { heading: HTMLElement; x: number; y: number; editor: Vditor; onClose: () => void }) {
  return (
    <ContextMenu modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <MarkdownContextMenuAnchor x={x} y={y} label="标题块操作" />
      <ContextMenuContent className="w-36" onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuItem onSelect={() => {
          const range = headingBlockRange(heading)
          if (!range) return
          const container = document.createElement("div")
          container.append(range.cloneContents())
          const markdown = restoreObsidianImages(editor.vditor.lute.VditorIRDOM2Md(container.innerHTML))
          void navigator.clipboard.writeText(markdown).catch((error) => toast.error(String(error)))
        }}><Copy />复制</ContextMenuItem>
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
        }}><Trash2 />删除</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem disabled><Focus />专注</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
