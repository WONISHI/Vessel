import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, PanelsTopLeft, PanelBottom, PanelLeft, PanelRight } from "lucide-react"
import { useState } from "react"
export type TransitDockMode = "left" | "right" | "bottom" | "floating"

/** Chooses a real dock location for the transit sheet. */
export function TransitDock({ value, onChange }: { value: TransitDockMode; onChange: (value: TransitDockMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button className="transit-bar-item transit-active" title="停靠位置" aria-label="中转站停靠方式"><PanelRight /></button></PopoverTrigger>
      <PopoverContent side="top" align="end" className="transit-dock-menu z-[260] w-40 p-1">
        <p className="px-2 py-1 text-[11px] text-stone-400">停靠位置</p>
        {([["left", "左侧", PanelLeft], ["right", "右侧", PanelRight], ["bottom", "底部", PanelBottom], ["floating", "悬浮", PanelsTopLeft]] as const).map(([mode, label, Icon]) => (
          <button key={mode} className="transit-dock-option" aria-pressed={mode === value} onClick={() => { onChange(mode); setOpen(false) }}><Icon />{label}{mode === value && <Check className="ml-auto" />}</button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
