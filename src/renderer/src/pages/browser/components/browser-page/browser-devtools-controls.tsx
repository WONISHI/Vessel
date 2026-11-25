import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Ellipsis, X } from "lucide-react"
import type { BrowserPageModel } from "./hooks/use-browser-page"

/** Overflow settings stay available when the docked console becomes narrow. */
export function BrowserDevtoolsControls({ b }: { b: BrowserPageModel }) {
  const dockControl = () => <select aria-label="控制台停靠位置" value={b.dock} onChange={event => b.setDock(event.target.value)}>
    <option value="bottom">底部停靠</option><option value="left">左侧停靠</option><option value="right">右侧停靠</option><option value="detached">独立窗口</option>
  </select>
  const fontControl = () => <select aria-label="控制台字体" value={b.consoleFont} onChange={event => b.setConsoleFont(event.target.value)}>
    {["Plus Jakarta Sans", "Menlo", "Consolas", "Courier New", "monospace", "system-ui"].map(font => <option key={font}>{font}</option>)}
  </select>
  const sizeControl = () => <select aria-label="控制台字号（整体缩放）" data-title="字号（整体缩放）" value={b.consoleSize} onChange={event => b.setConsoleSize(Number(event.target.value))}>
    {[11, 12, 13, 14, 16, 18, 20].map(size => <option key={size} value={size}>{size}px</option>)}
  </select>
  return <header className="browser-devtools-toolbar flex shrink-0 items-center gap-2 border-b px-2 py-1 text-xs text-stone-500">
    <span className="min-w-0 flex-1 truncate">网页控制台</span>
    <span className="devtools-dock-inline">{dockControl()}</span>
    <span className="devtools-font-inline">{fontControl()}</span>
    <span className="devtools-font-inline">{sizeControl()}</span>
    <Popover>
      <PopoverTrigger asChild><button type="button" aria-label="网页控制台更多设置" data-title="更多设置" className="devtools-overflow-trigger"><Ellipsis size={16} /></button></PopoverTrigger>
      <PopoverContent aria-label="网页控制台设置" align="end" className="browser-devtools-settings z-[300] w-60 rounded-xl p-3">
        <p className="mb-3 text-xs font-semibold">控制台设置</p>
        <div className="grid gap-3 text-xs">
          <label className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-2"><span>停靠位置</span>{dockControl()}</label>
          <label className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-2"><span>字体</span>{fontControl()}</label>
          <label className="grid grid-cols-[60px_minmax(0,1fr)] items-center gap-2"><span>字号</span>{sizeControl()}</label>
        </div>
      </PopoverContent>
    </Popover>
    <button type="button" aria-label="关闭网页控制台" onClick={() => b.setDevtoolsOpen(false)} className="devtools-close-trigger"><X size={14} /></button>
  </header>
}
