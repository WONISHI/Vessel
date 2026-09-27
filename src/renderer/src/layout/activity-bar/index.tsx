import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Sun } from "lucide-react"
import Logo from "@/assets/logo.png"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LayoutActivityBarProps } from "@/layout/activity-bar/types"
import { ACTIVITY_ITEMS } from "@/layout/activity-bar/constants"

/** 左侧窄活动栏：应用入口、活动切换和外观标识。 */
export default function LayoutActivityBar({ activity, onActivityChange }: LayoutActivityBarProps) {
  const { open, openMobile, isMobile } = useSidebar()
  const expanded = isMobile ? openMobile : open
  return (
    <TooltipProvider delayDuration={250}>
      <nav
        aria-label="工作台活动栏"
        className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#f0efed] py-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="group/logo relative mb-2 block size-[30px]">
              <img
                src={Logo}
                alt=""
                className="pointer-events-none absolute inset-0 size-full object-contain p-0.5 group-hover/logo:opacity-0 group-focus-within/logo:opacity-0"
              />
              <SidebarTrigger
                aria-label={expanded ? "收起侧边栏" : "展开侧边栏"}
                aria-expanded={expanded}
                className="size-[30px] rounded-lg text-stone-700 [&>svg]:opacity-0 hover:bg-stone-100 group-hover/logo:[&>svg]:!opacity-100 group-focus-within/logo:[&>svg]:!opacity-100"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-stone-200 bg-white text-xs text-stone-700"
          >
            {expanded ? "收起侧边栏" : "展开侧边栏"}
          </TooltipContent>
        </Tooltip>
        {ACTIVITY_ITEMS.map(({ id, label, icon: Icon }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={label}
                aria-pressed={activity === id}
                onClick={() => onActivityChange(id)}
                className={cn("h-[38px] w-[38px] rounded-[10px] text-stone-500 hover:bg-[#f0efed]", activity === id && "bg-emerald-50 text-green-700 hover:bg-emerald-50")}
              >
                <Icon className="!size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              sideOffset={10}
              className="border-stone-200 bg-white text-xs text-stone-700"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
        <span
          title="浅色外观"
          className="mt-auto flex size-[38px] items-center justify-center text-stone-500"
        >
          <Sun className="size-5" />
        </span>
      </nav>
    </TooltipProvider>
  )
}
