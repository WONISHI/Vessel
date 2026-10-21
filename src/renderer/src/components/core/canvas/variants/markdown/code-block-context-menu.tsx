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

const menuItemClass =
  "text-xs rounded-md cursor-pointer transition-colors focus:bg-green-600 focus:!text-white focus:[&_*]:!text-white focus:[&_svg]:!text-white data-[highlighted]:bg-green-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white data-[state=open]:bg-green-600 data-[state=open]:!text-white data-[state=open]:[&_*]:!text-white data-[state=open]:[&_svg]:!text-white"

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
        className="vessel-code-block-menu w-36 z-[260] p-1"
        align="start"
        sideOffset={4}
        collisionPadding={8}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={readOnly} className={menuItemClass}>

            <span>聚焦</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent className="vessel-code-block-menu w-36 z-[260] p-1" collisionPadding={8}>
              <DropdownMenuItem
                disabled={readOnly}
                className={menuItemClass}
                onSelect={() => {
                  onClose()
                  requestAnimationFrame(onFocusAbove)
                }}
              >

                <span>在上方聚焦</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={readOnly}
                className={menuItemClass}
                onSelect={() => {
                  onClose()
                  requestAnimationFrame(onFocusBelow)
                }}
              >

                <span>在下方聚焦</span>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuItem
          className={menuItemClass}
          onSelect={() => {
            onClose()
            onCopy()
          }}
        >

          <span>复制</span>
        </DropdownMenuItem>

        {!readOnly && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-xs rounded-md cursor-pointer text-red-600 focus:bg-red-600 focus:!text-white focus:[&_*]:!text-white focus:[&_svg]:!text-white data-[highlighted]:bg-red-600 data-[highlighted]:!text-white data-[highlighted]:[&_*]:!text-white data-[highlighted]:[&_svg]:!text-white"
              onSelect={() => {
                onClose()
                onDelete()
              }}
            >

              <span>删除</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
