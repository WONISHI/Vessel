import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { Sun } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { LayoutActivityBarProps } from "./types"
import { ACTIVITY_ITEMS } from "./constants"

/** 左侧窄活动栏：应用入口、活动切换和外观标识。 */
export default function LayoutActivityBar({ activity, onActivityChange }: LayoutActivityBarProps) {
  const navigate = useNavigate()
  return (
    <TooltipProvider delayDuration={250}>
      <nav
        aria-label="工作台活动栏"
        className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#f0efed] py-2.5"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label="返回欢迎页"
              onClick={() => navigate("/")}
              className="mb-2 h-[30px] w-[30px] rounded-lg bg-gradient-to-br from-stone-900 to-stone-700 p-0 text-[13px] font-extrabold text-white"
            >
              V
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-stone-200 bg-white text-xs text-stone-700"
          >
            返回欢迎页
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
