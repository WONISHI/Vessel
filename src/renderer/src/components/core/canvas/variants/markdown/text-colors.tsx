import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Type, Highlighter, X, Slash } from "lucide-react"
const colors = ['#1c1917','#78716c','#d6d3d1','#ffffff','#ff4d4f','#f97316','#eab308','#84cc16','#16a34a','#14b8a6','#0ea5e9','#2563eb','#7c3aed','#db2777','#fecaca','#fed7aa','#fef08a','#d9f99d','#bbf7d0','#99f6e4','#bae6fd','#bfdbfe','#ddd6fe','#fbcfe8']
export function TextColors({ anchor, onApply, onClose }: { anchor: { left: number; top: number }; onApply: (color: string | null, background: boolean) => void; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const [background, setBackground] = useState(false)
  const [custom, setCustom] = useState('#ff4d4f')
  useEffect(() => {
    const pointer = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) onClose() }
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key, true)
    return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key, true) }
  }, [onClose])
  return createPortal(<div ref={host} role="dialog" aria-label="文字颜色与背景色" className="fixed z-[280] w-64 rounded-lg border bg-white p-3 text-xs text-stone-600 shadow-lg" style={{ left: Math.max(8, Math.min(innerWidth-264,anchor.left)), top: Math.min(innerHeight-300,anchor.top) }} onMouseDown={event => { if ((event.target as HTMLElement).tagName !== 'INPUT') event.preventDefault() }}>
    <div className="mb-3 flex items-center gap-1">
      <button aria-pressed={!background} onClick={() => setBackground(false)} className={`flex items-center gap-1 rounded p-2 ${!background ? 'bg-green-50 text-green-700' : ''}`}><Type size={14} />文字颜色</button>
      <button aria-pressed={background} onClick={() => setBackground(true)} className={`flex items-center gap-1 rounded p-2 ${background ? 'bg-green-50 text-green-700' : ''}`}><Highlighter size={14} />背景颜色</button>
      <button aria-label="关闭颜色面板" onClick={onClose} className="ml-auto"><X size={14} /></button>
    </div>
    <div className="grid grid-cols-6 gap-2"><button aria-label={background ? "取消背景颜色" : "取消文字颜色"} title="取消颜色" className="flex size-7 items-center justify-center rounded border border-stone-200 bg-white hover:ring-2 hover:ring-green-500" onClick={() => onApply(null, background)}><Slash size={20} className="text-red-400" /></button>{colors.map(color => <button key={color} aria-label={`${background ? '背景' : '文字'} ${color}`} title={color} className="size-7 rounded border border-stone-200 hover:ring-2 hover:ring-green-500" style={{ backgroundColor: color }} onClick={() => onApply(color, background)} />)}</div>
    <div className="mt-3 flex items-center gap-2"><label htmlFor="vessel-custom-color">自定义</label><input id="vessel-custom-color" aria-label="自定义颜色" type="color" value={custom} onChange={event => setCustom(event.target.value)} className="h-7 w-10" /><button className="ml-auto rounded border px-3 py-1" onClick={() => onApply(custom, background)}>应用</button></div>
  </div>, document.body)
}
