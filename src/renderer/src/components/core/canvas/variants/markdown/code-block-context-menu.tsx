import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"
import { Copy, CornerLeftUp, CornerLeftDown, Focus, Trash2 } from "lucide-react"

interface CodeBlockContextMenuProps {
  x: number
  y: number
  readOnly?: boolean
  onClose: () => void
  onFocusAbove: () => void
  onFocusBelow: () => void
  onCopy: () => void
  onDelete: () => void
}

/** Shows a context menu when right-clicking a code block header. */
export function CodeBlockContextMenu({
  x,
  y,
  readOnly = false,
  onClose,
  onFocusAbove,
  onFocusBelow,
  onCopy,
  onDelete
}: CodeBlockContextMenuProps) {
  return (
    <DropdownMenu open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <DropdownMenuTrigger
        aria-label="代码块上下文菜单"
        style={{ position: "fixed", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }}
      />
      <DropdownMenuContent
        className="w-36 z-[260]"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={readOnly}>
            <Focus className="size-4" />
            <span>聚焦</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="w-36 z-[260]" collisionPadding={8}>
              <DropdownMenuItem
                disabled={readOnly}
                onSelect={() => {
                  onClose()
                  requestAnimationFrame(onFocusAbove)
                }}
              >
                <CornerLeftUp className="size-4" />
                <span>在上方聚焦</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={readOnly}
                onSelect={() => {
                  onClose()
                  requestAnimationFrame(onFocusBelow)
                }}
              >
                <CornerLeftDown className="size-4" />
                <span>在下方聚焦</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuItem
          onSelect={() => {
            onClose()
            onCopy()
          }}
        >
          <Copy className="size-4" />
          <span>复制</span>
        </DropdownMenuItem>

        {!readOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:bg-red-600 focus:text-white data-[highlighted]:bg-red-600 data-[highlighted]:!text-white"
              onSelect={() => {
                onClose()
                onDelete()
              }}
            >
              <Trash2 className="size-4" />
              <span>删除</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
