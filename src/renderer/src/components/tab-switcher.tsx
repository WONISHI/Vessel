import { useRef, useEffect, useState, type ReactNode } from "react"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
export function TabSwitcher({ children, tabs, onSelect, side = "bottom" }: { children: ReactNode; tabs: { id: string; title: string; active?: boolean }[]; onSelect: (id: string) => void; side?: "bottom" | "right" }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const enter = () => { clearTimeout(timer.current); setOpen(true) }
  const leave = () => { timer.current = setTimeout(() => setOpen(false), 180) }
  useEffect(() => () => clearTimeout(timer.current), [])
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><span className="inline-flex shrink-0" onMouseEnter={enter} onMouseLeave={leave} onFocus={enter}>{children}</span></PopoverTrigger><PopoverContent side={side} align="start" onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onMouseEnter={enter} onMouseLeave={leave} className="z-[70] w-64 p-1"><div className="px-2 py-2 text-xs text-stone-400">已打开 {tabs.length} 个标签页</div><div className="max-h-72 overflow-auto">{tabs.map(tab => <button key={tab.id} onClick={() => { onSelect(tab.id); setOpen(false) }} className={`block w-full truncate rounded px-2 py-2 text-left text-xs hover:bg-emerald-50 ${tab.active ? 'bg-emerald-50 text-green-700' : ''}`} title={tab.title}>{tab.title}</button>)}</div></PopoverContent></Popover>
}
