import { AlertCircle, AlertTriangle, CheckCircle2, FileText, Info, Play, Square } from "lucide-react"
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { DevToolsMenuProps } from "../src/type"

const checkboxItemClassName =
  "cursor-pointer rounded-md py-[6px] pr-2 text-[12.5px] text-stone-700 " +
  "focus:bg-[#faf9f7] data-[state=checked]:text-stone-700 " +
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

export function DevToolsMenu({ isSpyEnabled, enabledTypes, hasError, menuItems, onToggleSpy, onToggleType }: DevToolsMenuProps) {
  return (
    <DropdownMenuContent
      align="end"
      sideOffset={8}
      className="
        w-[240px]
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
        className="
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
        onClick={onToggleSpy}
        className="
          cursor-pointer
          gap-[8px]
          rounded-none
          px-[12px]
          py-[7px]
          text-[13px]
          text-stone-700
          focus:bg-[#faf9f7]
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
            focus:bg-[#faf9f7]
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
            overflow-hidden
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

      {menuItems.map((item) => {
        const Icon = item.icon
        return (
          <DropdownMenuItem
            key={item.key}
            onClick={item.onClick}
            className="
              cursor-pointer
              gap-[8px]
              rounded-none
              px-[12px]
              py-[7px]
              text-[13px]
              text-stone-700
              focus:bg-[#faf9f7]
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
