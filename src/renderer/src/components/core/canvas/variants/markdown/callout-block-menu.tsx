import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger } from "@/components/ui/context-menu"
import { MarkdownContextMenuAnchor } from "./context-menu-anchor"

export function CalloutBlockMenu({ x, y, collapsed, onToggleFold, onClose, onFocus, onCopy, onDelete }: { x: number; y: number; collapsed: boolean; onToggleFold: () => void; onClose: () => void; onFocus: (below: boolean) => void; onCopy: () => void; onDelete: () => void }) {
  return (
    <ContextMenu modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <MarkdownContextMenuAnchor x={x} y={y} label="Callout 操作菜单" />
      <ContextMenuContent className="markdown-insert-menu markdown-callout-block-menu" collisionPadding={8} onCloseAutoFocus={(event) => event.preventDefault()}>
        <ContextMenuSub>
          <ContextMenuSubTrigger>聚焦</ContextMenuSubTrigger>
          <ContextMenuSubContent className="markdown-insert-menu markdown-insert-submenu" collisionPadding={8}>
            <ContextMenuItem onSelect={() => requestAnimationFrame(() => onFocus(false))}>在上方聚焦</ContextMenuItem>
            <ContextMenuItem onSelect={() => requestAnimationFrame(() => onFocus(true))}>在下方聚焦</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem onSelect={onToggleFold}>{collapsed ? "展开" : "折叠"}</ContextMenuItem>
        <ContextMenuItem onSelect={onCopy}>复制</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-red-600" onSelect={onDelete}>删除</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
