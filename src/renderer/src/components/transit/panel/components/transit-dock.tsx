import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import "@vscode/codicons/dist/codicon.css"
import { useState } from "react"
export type TransitDockMode = "left" | "right" | "top" | "bottom" | "floating"
const dockOptions = [["left", "左侧", "layout-sidebar-left"], ["right", "右侧", "layout-sidebar-right"], ["top", "顶部", "layout-panel"], ["bottom", "底部", "layout-panel"], ["floating", "悬浮", "multiple-windows"]] as const

/** Chooses a real dock location for the transit sheet. */
export function TransitDock({ value, onChange }: { value: TransitDockMode; onChange: (value: TransitDockMode) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild><button className="transit-bar-item" data-title="停靠位置" aria-label="中转站停靠方式"><i aria-hidden="true" className={`codicon codicon-${dockOptions.find(([mode]) => mode === value)![2]} ${value === "top" ? "rotate-180" : ""}`} /></button></PopoverTrigger>
      <PopoverContent side="top" align="end" className="transit-dock-menu z-[260] w-40 p-1">
        <p className="px-2 py-1 text-[11px] text-stone-400">停靠位置</p>
        {dockOptions.map(([mode, label, icon]) => (
          <button key={mode} className="transit-dock-option" aria-pressed={mode === value} onClick={() => { onChange(mode); setOpen(false) }}><i aria-hidden="true" className={`codicon codicon-${icon} ${mode === "top" ? "rotate-180" : ""}`} />{label}{mode === value && <i aria-hidden="true" className="codicon codicon-check ml-auto" />}</button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
