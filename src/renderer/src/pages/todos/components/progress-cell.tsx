import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import { Check, MoreVertical } from "lucide-react"
import { useState, type CSSProperties } from "react"

export function ProgressCell({ progress, onUpdateProgressValue, onChangeAllProgressColor }: { progress?: { value: number; colorClass?: string }; onUpdateProgressValue: (val: number) => void; onChangeAllProgressColor: (colorClass: string) => void }) {
  const [open, setOpen] = useState(false)
  const val = progress?.value ?? 0
  const color = progress?.colorClass || "bg-green-600"
  const accent = ({ "bg-green-600": "#16a34a", "bg-blue-600": "#2563eb", "bg-purple-600": "#9333ea", "bg-amber-600": "#d97706", "bg-red-600": "#dc2626" } as Record<string, string>)[color] || "#16a34a"

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <div className="group flex items-center gap-2 w-full cursor-pointer py-1 px-1 rounded hover:bg-stone-100/70 transition-colors">
          <div className="h-2 min-w-[60px] flex-1 rounded-full bg-stone-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", color)}
              style={{ width: `${val}%` }}
            />
          </div>
          <span className="text-[11px] font-normal text-stone-500 w-8 text-right">{val}%</span>
          <MoreVertical className="size-3 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="todo-progress-picker w-56 p-3 bg-white shadow-xl z-[200]"
        style={{ "--progress-color": accent } as CSSProperties}
      >
        <div
          style={{ color: accent }}
          className="text-xs font-bold mb-2"
        >
          修改进度: {val}%
        </div>

        {/* 需求 3：使用 shadcn 的 Slider 滚动条组件 */}
        <div className="mb-3 px-1">
          <Slider
            aria-label="待办进度"
            value={[val]}
            onValueChange={([v]) => onUpdateProgressValue(v)}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>

        <div className="flex gap-1 mb-3">
          {[0, 25, 50, 75, 100].map((p) => (
            <button
              key={p}
              onClick={() => onUpdateProgressValue(p)}
              className={cn("flex-1 py-0.5 text-[10px] rounded border transition-colors", val === p ? "border-green-600 bg-green-50 text-green-700 font-bold" : "border-stone-200 hover:bg-stone-50 text-stone-600")}
            >
              {p}%
            </button>
          ))}
        </div>

        {/* 需求 2：修改进度条颜色，同步同属性列的全部进度条颜色 */}
        <div className="text-[10px] text-stone-400 mb-1.5">进度条统一颜色 (同步整列):</div>
        <div className="flex gap-2">
          {[
            { label: "绿色", class: "bg-green-600" },
            { label: "蓝色", class: "bg-blue-600" },
            { label: "紫色", class: "bg-purple-600" },
            { label: "橙色", class: "bg-amber-600" },
            { label: "红色", class: "bg-red-600" }
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => onChangeAllProgressColor(c.class)}
              className={cn("size-5 rounded-full border border-stone-300 hover:scale-110 transition-transform flex items-center justify-center", c.class)}
              title={`整列改为${c.label}`}
            >
              {color === c.class && <Check className="size-3 text-white" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
