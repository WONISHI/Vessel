import type { DevToolsMenuProps } from "@/components/core/devtool/src/type"
import { DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, Play, Square, Trash2 } from "lucide-react"

const checkboxItemClassName =
  "cursor-pointer rounded-md py-[6px] pr-2 text-[12.5px] text-stone-700 " +
  "focus:bg-[#faf9f7] data-[highlighted]:bg-[#faf9f7] data-[highlighted]:text-stone-700 data-[state=checked]:text-stone-700 " +
  "[&>span:first-child]:h-[14px] " +
  "[&>span:first-child]:w-[14px] " +
  "[&>span:first-child]:rounded-[4px] " +
  "[&>span:first-child]:border " +
  "[&>span:first-child]:border-stone-300 " +
  "data-[state=checked]:[&>span:first-child]:border-green-600 " +
  "data-[state=checked]:[&>span:first-child]:bg-green-600 " +
  "data-[state=checked]:[&>span:first-child]:text-white " +
  "[&>span:first-child_svg]:h-[10px] " +
  "[&>span:first-child_svg]:w-[10px]"

/** Renders the dev tools menu component. */
export function DevToolsMenu({ isSpyEnabled, enabledTypes, hasError, menuItems, onToggleSpy, onToggleType, databaseSyncConfigured, remoteDeletionAvailable, onDeleteData, onCloseAutoFocus }: DevToolsMenuProps) {
  return (
    <DropdownMenuContent
      onCloseAutoFocus={onCloseAutoFocus}
      align="end"
      sideOffset={8}
      className="
        dev-actions-menu z-[321] w-[240px]
        overflow-hidden
        rounded-xl
        border
        border-[#e7e5e4]
        bg-white
        p-0
        shadow-[0_10px_40px_rgba(0,0,0,0.1)]
      "
    >
      <DropdownMenuLabel
        className="dev-actions-heading
          flex
          items-center
          justify-between
          border-b
          border-[#f0efed]
          px-[12px]
          py-[8px]
        "
      >
        <span
          className="
            text-[11px]
            font-bold
            uppercase
            tracking-[0.5px]
            text-stone-600
          "
        >
          Dev Actions
        </span>

        {hasError && (
          <span
            className="
              rounded-md
              bg-red-50
              px-2
              py-0.5
              text-[10px]
              font-bold
              text-red-600
            "
          >
            Errors!
          </span>
        )}
      </DropdownMenuLabel>

      <DropdownMenuItem
        data-dev-master={isSpyEnabled ? "on" : "off"}
        onClick={onToggleSpy}
        className="
          cursor-pointer
          gap-[8px]
          rounded-none
          px-[12px]
          py-[7px]
          text-[13px]
          text-stone-700
          focus:bg-[#faf9f7] data-[highlighted]:bg-[#faf9f7] data-[highlighted]:text-stone-700
          focus:text-stone-700
        "
      >
        {isSpyEnabled ? (
          <Square
            className="
              h-[15px]
              w-[15px]
              text-green-600
            "
          />
        ) : (
          <Play
            className="
              h-[15px]
              w-[15px]
              text-stone-500
            "
          />
        )}
        <span>{isSpyEnabled ? "关闭 Console 监听 (总开关)" : "开启 Console 监听 (总开关)"}</span>
      </DropdownMenuItem>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className="
            cursor-pointer
            gap-[8px]
            rounded-none
            px-[12px]
            py-[7px]
            text-[13px]
            text-stone-700
            focus:bg-[#faf9f7] data-[highlighted]:bg-[#faf9f7] data-[highlighted]:text-stone-700
            data-[state=open]:bg-[#faf9f7]
          "
        >
          <CheckCircle2
            className="
              h-[15px]
              w-[15px]
              text-stone-500
            "
          />

          <span>监听类型设置</span>
        </DropdownMenuSubTrigger>

        <DropdownMenuSubContent
          className="
            dev-actions-menu dev-actions-submenu z-[322] overflow-hidden
            rounded-[10px]
            border
            border-[#e7e5e4]
            bg-white
            p-0
            shadow-[0_8px_30px_rgba(0,0,0,0.1)]
          "
        >
          <div className="w-[170px] p-1">
            <DropdownMenuCheckboxItem
              checked={enabledTypes.log}
              onCheckedChange={() => {
                onToggleType("log")
              }}
              className={checkboxItemClassName}
            >
              <FileText
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-teal-600
                "
              />
              Log
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.info}
              onCheckedChange={() => {
                onToggleType("info")
              }}
              className={checkboxItemClassName}
            >
              <Info
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-cyan-600
                "
              />
              Info
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.warn}
              onCheckedChange={() => {
                onToggleType("warn")
              }}
              className={checkboxItemClassName}
            >
              <AlertTriangle
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-amber-600
                "
              />
              Warn
            </DropdownMenuCheckboxItem>

            <DropdownMenuCheckboxItem
              checked={enabledTypes.error}
              onCheckedChange={() => {
                onToggleType("error")
              }}
              className={checkboxItemClassName}
            >
              <AlertCircle
                className="
                  mr-2
                  h-[14px]
                  w-[14px]
                  text-red-600
                "
              />
              Error
            </DropdownMenuCheckboxItem>
          </div>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSeparator
        className="
          my-1
          bg-[#f0efed]
        "
      />

      {onDeleteData && <DropdownMenuSub>
        <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-none px-3 py-[7px] text-[13px] text-red-600 focus:bg-red-50 focus:text-red-600 data-[state=open]:bg-red-50 data-[state=open]:text-red-600 data-[highlighted]:text-red-600"><Trash2 className="size-[15px]" /><span>删除数据</span></DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="dev-actions-menu dev-actions-submenu z-[322] min-w-64 rounded-xl border bg-white p-1 shadow-lg">
          <DropdownMenuItem className="gap-2 text-xs text-red-600" onSelect={() => onDeleteData('local')}>删除本地域（数据库）</DropdownMenuItem>
          {databaseSyncConfigured && <>
            <DropdownMenuItem className="gap-2 text-xs text-red-600" disabled={!remoteDeletionAvailable} onSelect={() => onDeleteData('both')}>删除本地域（数据库）和远程域（数据库）</DropdownMenuItem>
            <DropdownMenuItem className="gap-2 text-xs text-red-600" disabled={!remoteDeletionAvailable} onSelect={() => onDeleteData('remote')}>删除远程域（数据库）</DropdownMenuItem>
            {!remoteDeletionAvailable && <p className="max-w-64 px-2 py-2 text-[11px] leading-5 text-muted-foreground">请先在设置 → 同步 → 自定域同步中连接并登录，再删除远程数据。</p>}
          </>}
        </DropdownMenuSubContent>
      </DropdownMenuSub>}
      {menuItems.map((item) => {
        const Icon = item.icon
        return (
          <DropdownMenuItem
            key={item.key}
            data-dev-action={item.key}
            onClick={item.onClick}
            className="
              cursor-pointer
              gap-[8px]
              rounded-none
              px-[12px]
              py-[7px]
              text-[13px]
              text-stone-700
              focus:bg-[#faf9f7] data-[highlighted]:bg-[#faf9f7] data-[highlighted]:text-stone-700
              focus:text-stone-700
            "
          >
            <Icon className={cn("h-[15px] w-[15px]", item.iconClassName || "text-stone-500")} />
            <span>{item.label}</span>
          </DropdownMenuItem>
        )
      })}
    </DropdownMenuContent>
  )
}
