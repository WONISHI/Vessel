import { useState } from 'react'
import { Code, Copy, Download, Palette, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ImageEditorSheet } from '@/pages/image-preview/editor-sheet'
import { toast } from 'sonner'
const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast.success('已复制')).catch(e => toast.error(String(e)))
export function OCRTool() { return <ImageEditorSheet embedded open source="" onOpenChange={() => {}} onCrop={() => {}} /> }
function TextTool({ mode }: { mode: 'base64' | 'url' }) {
  const [input,setInput] = useState(''), [output,setOutput] = useState(''), [error,setError] = useState('')
  const run = (reverse = false) => {
    try {
      const result = mode === 'url' ? reverse ? decodeURIComponent(input) : encodeURIComponent(input) : reverse ? new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(input), c => c.charCodeAt(0))) : btoa(Array.from(new TextEncoder().encode(input), b => String.fromCharCode(b)).join(''))
      setOutput(result); setError('')
    } catch(e) { setError(String(e)); setOutput('') }
  }
  const name = mode === 'base64' ? 'Base64' : 'URL 编解码'
  return <div className="flex h-full min-h-0 flex-col"><header className="flex items-center gap-3 border-b p-4"><span className="rounded-lg bg-emerald-50 p-2 text-green-600"><Code size={16} /></span><h2 className="text-sm font-semibold">{name}</h2><span className="text-xs text-stone-400">本地处理，即时转换</span><Button size="sm" className="ml-auto bg-green-600 text-white hover:bg-green-700" onClick={() => run()}><Code size={13} />编码</Button><Button size="sm" variant="outline" onClick={() => run(true)}><Code size={13} />解码</Button></header>{error && <p role="alert" className="bg-red-50 px-4 py-2 text-xs text-red-600">{error}</p>}<div className="dual-tools grid min-h-0 flex-1 grid-cols-2"><section className="flex min-h-0 flex-col border-r"><div className="flex h-10 items-center border-b bg-stone-50 px-3 text-xs text-stone-500">输入<Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="清空输入" onClick={() => { setInput(''); setOutput(''); setError('') }}><Trash2 size={14}/></Button></div><Textarea aria-label={`${name}输入`} value={input} onChange={e => setInput(e.target.value)} placeholder="在此输入内容…" className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs shadow-none focus-visible:ring-0" /></section><section className="flex min-h-0 flex-col"><div className="flex h-10 items-center gap-1 border-b bg-stone-50 px-3 text-xs text-stone-500">处理结果<Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="复制结果" disabled={!output} onClick={() => copy(output)}><Copy size={14}/></Button><Button size="icon" variant="ghost" className="size-7" aria-label="下载结果" disabled={!output} onClick={() => { const url = URL.createObjectURL(new Blob([output], {type:'text/plain'})); const a = document.createElement('a'); a.href=url; a.download='result.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000) }}><Download size={14}/></Button></div><Textarea aria-label="处理结果" readOnly value={output} className="min-h-0 flex-1 resize-none rounded-none border-0 p-4 font-mono text-xs shadow-none focus-visible:ring-0" /></section></div></div>
}
export { JsonTool } from './json-tool'
export function Base64Tool() { return <TextTool mode="base64" /> }
export function URLTool() { return <TextTool mode="url" /> }
export function ColorTool() {
  const [rgba,setRgba] = useState([22,163,74,100]), [draft,setDraft] = useState(''), [rgbaDraft,setRgbaDraft] = useState(''), [error,setError] = useState('')
  const [r,g,b,a] = rgba, hex = '#' + rgba.slice(0,3).map(v => v.toString(16).padStart(2,'0')).join('').toUpperCase()
  const max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255, delta=max-min, light=(max+min)/2
  const hue = delta === 0 ? 0 : ((max === r/255 ? (g-b)/255/delta : max === g/255 ? (b-r)/255/delta+2 : (r-g)/255/delta+4)*60+360)%360
  const hsl = `hsl(${Math.round(hue)}, ${Math.round(delta === 0 ? 0 : delta/(1-Math.abs(2*light-1))*100)}%, ${Math.round(light*100)}%)`
  const changeHex = (value: string) => { if (!/^#[a-f\d]{6}$/i.test(value)) { setError('请输入 6 位 HEX 颜色，例如 #16A34A'); return } setRgba([parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16),a]); setDraft(''); setError('') }
  const changeRgba = (value: string) => {
    const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0?\.\d+|[01](?:\.0+)?))?\s*\)$/i)
    if (!match || match.slice(1,4).some(v => Number(v) > 255)) { setError('请输入有效 RGB 或 RGBA，例如 rgba(22, 163, 74, 1)'); return }
    setRgba([Number(match[1]), Number(match[2]), Number(match[3]), Math.round(Number(match[4] ?? 1) * 100)])
    setRgbaDraft(''); setDraft(''); setError('')
  }
  return <div className="flex h-full flex-col"><header className="flex items-center gap-3 border-b p-4"><span className="rounded-lg bg-emerald-50 p-2 text-green-600"><Palette size={16}/></span><h2 className="text-sm font-semibold">颜色转换</h2><span className="text-xs text-stone-400">HEX、RGB、RGBA 与 HSL</span></header><ScrollArea className="min-h-0 flex-1"><div className="color-controls grid grid-cols-2 gap-8 p-6"><section className="space-y-5"><div className="color-preview h-40 rounded-lg border"><div className="absolute inset-0" style={{background:`rgba(${r},${g},${b},${a/100})`}}/></div><label className="block space-y-2 text-xs text-stone-500">HEX<div className="flex gap-2"><Input aria-label="HEX" value={draft || hex} onChange={e => setDraft(e.target.value)} onBlur={() => { if(draft) changeHex(draft) }} onKeyDown={e => { if(e.key==='Enter') changeHex(draft || hex) }} className="font-mono text-xs"/><Button variant="outline" size="icon" aria-label="复制 HEX" onClick={() => copy(hex)}><Copy size={14}/></Button></div></label><label className="block space-y-2 text-xs text-stone-500">RGBA<div className="flex gap-2"><Input aria-label="RGBA" value={rgbaDraft || `rgba(${r}, ${g}, ${b}, ${a/100})`} onChange={e => setRgbaDraft(e.target.value)} onBlur={() => { if (rgbaDraft) changeRgba(rgbaDraft) }} onKeyDown={e => { if(e.key === 'Enter') changeRgba(rgbaDraft || `rgba(${r}, ${g}, ${b}, ${a/100})`) }} className="font-mono text-xs"/><Button variant="outline" size="icon" aria-label="复制 RGBA" onClick={() => copy(`rgba(${r}, ${g}, ${b}, ${a/100})`)}><Copy size={14}/></Button></div></label>{error && <p role="alert" className="text-xs text-red-600">{error}</p>}<p className="text-xs text-stone-500">预设</p><div className="flex flex-wrap gap-2">{['#16A34A','#2563EB','#7C3AED','#DC2626','#D97706','#0D9488','#1C1917','#78716C'].map(color => <Button key={color} size="icon" aria-label={`颜色 ${color}`} className="size-7 rounded-full border" style={{background:color}} onClick={() => changeHex(color)}/>)}</div></section><section className="space-y-6"><h3 className="text-xs text-stone-500">RGBA 滑块</h3>{['R','G','B','A'].map((label,index) => <div className="flex items-center gap-3 text-xs" key={label}><span className="w-3">{label}</span><Slider aria-label={label} value={[rgba[index]]} min={0} max={index===3 ? 100 : 255} step={1} onValueChange={values => { setRgba(rgba.map((v,i) => i===index ? values[0] : v)); setDraft('') }}/><span className="w-8 text-right font-mono">{index===3 ? a/100 : rgba[index]}</span></div>)}{[`rgb(${r}, ${g}, ${b})`,hsl].map(value => <div className="flex gap-2" key={value}><Input readOnly value={value} className="font-mono text-xs"/><Button variant="outline" size="icon" aria-label={`复制 ${value}`} onClick={() => copy(value)}><Copy size={14}/></Button></div>)}</section></div></ScrollArea></div>
}
