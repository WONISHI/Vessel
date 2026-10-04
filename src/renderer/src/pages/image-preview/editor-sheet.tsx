import { recognizeImage } from '@/lib/image-ocr'
import { useEffect, useRef, useState } from 'react'
import { Activity, Upload, ImageIcon, FileText, Copy, Crop, ClipboardPaste, ZoomIn, ZoomOut, Maximize } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
export function ImageEditorSheet({ open, onOpenChange, source, onCrop, embedded = false }: { open: boolean; onOpenChange: (open: boolean) => void; source: string; onCrop: () => void; embedded?: boolean }) {
  const [imported, setImported] = useState('')
  const [result, setResult] = useState('')
  const [tab, setTab] = useState('image')
  const [busy, setBusy] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const image = imported || source
  const [zoom, setZoom] = useState(1)
  const [canvas, setCanvas] = useState<HTMLDivElement | null>(null)
  const [bounds, setBounds] = useState({ width: 1, height: 1 })
  const [natural, setNatural] = useState({ width: 1, height: 1 })
  useEffect(() => {
    if (!canvas) return
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width && entry.contentRect.height) setBounds({ width: entry.contentRect.width, height: entry.contentRect.height }) })
    observer.observe(canvas); return () => observer.disconnect()
  }, [canvas])
  const fit = Math.min(1, Math.max(1, bounds.width - 48) / natural.width, Math.max(1, bounds.height - 48) / natural.height)
  const importImage = (value: string) => { setImported(value); setResult(''); setTab('image'); setZoom(1) }
  const paste = async () => { try { const value = await window.electronAPI.readClipboardImage(); if (value) importImage(value); else toast.info('剪贴板中没有图片，请先复制图片或截图') } catch (e) { toast.error(String(e)) } }
  const whiteIcon = 'hover:!text-white active:!text-white [&:hover_svg]:!text-white [&:active_svg]:!text-white'

  const recognize = async () => {
    setBusy(true)
    try { const text = await recognizeImage(image); setResult(text); setTab('result'); if (!text) toast.info('未识别到文字') } catch (e) { toast.error(String(e)) } finally { setBusy(false) }
  }
  const Title = embedded ? "h2" : SheetTitle
  const Description = embedded ? "p" : SheetDescription
  const content = <>
    <header className="flex flex-wrap items-center gap-3 border-b p-4 pr-12"><span className="rounded-lg bg-emerald-50 p-2 text-green-600"><Activity size={18} /></span><div><Title className="text-base font-semibold">图片 OCR</Title><Description className="text-xs text-stone-400">截图识别文字，本地离线</Description></div><div className="ml-auto flex gap-2"><Button size="sm" variant="ghost" className={whiteIcon} disabled={busy} onClick={() => input.current?.click()}><Upload size={14} />导入图片</Button><Button size="sm" variant="ghost" className={whiteIcon} disabled={busy} onClick={() => void paste()}><ClipboardPaste size={14} />读取剪贴板</Button><Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={busy || !image} onClick={() => void recognize()}><Activity size={14} />{busy ? '识别中…' : '开始识别'}</Button></div></header>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 30_000_000) { toast.error('图片不能超过 30 MB'); return } const reader = new FileReader(); reader.onload = () => { importImage(String(reader.result)) }; reader.onerror = () => toast.error('读取图片失败'); reader.readAsDataURL(file); event.target.value = '' }} />
    <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0"><div className="flex items-center border-b bg-stone-50 px-4 py-2"><TabsList><TabsTrigger value="image"><ImageIcon size={14} />截图</TabsTrigger><TabsTrigger value="result"><FileText size={14} />识别结果</TabsTrigger></TabsList><div className="ml-auto flex items-center gap-1"><Button variant="ghost" size="icon" className={whiteIcon + ' size-8'} aria-label="缩小图片" disabled={!image || zoom <= 0.25} onClick={() => setZoom(value => Math.max(0.25, value - 0.25))}><ZoomOut size={16} /></Button><span className="w-10 text-center text-xs tabular-nums text-stone-500">{Math.round(zoom * 100)}%</span><Button variant="ghost" size="icon" className={whiteIcon + ' size-8'} aria-label="放大图片" disabled={!image || zoom >= 4} onClick={() => setZoom(value => Math.min(4, value + 0.25))}><ZoomIn size={16} /></Button><Button variant="ghost" size="icon" className={whiteIcon + ' size-8'} aria-label="图片适应画布" disabled={!image} onClick={() => setZoom(1)}><Maximize size={15} /></Button></div>{!embedded && !imported && <Button className="ml-auto" size="sm" variant="ghost" onClick={() => { onOpenChange(false); onCrop() }}><Crop size={14} />裁剪</Button>}</div>
    <TabsContent ref={setCanvas} value="image" className="relative mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"><ScrollArea className="absolute inset-0 bg-stone-50 [background-image:radial-gradient(#e7e5e4_1px,transparent_1px)] [background-size:16px_16px]"><div className="flex items-center justify-center p-6" style={{ minWidth: bounds.width, minHeight: bounds.height, width: image ? Math.max(bounds.width, natural.width * fit * zoom + 48) : bounds.width, height: image ? Math.max(bounds.height, natural.height * fit * zoom + 48) : bounds.height }}>{image ? <img src={image} alt="待识别图片" onLoad={event => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })} style={{ width: natural.width * fit * zoom, height: natural.height * fit * zoom, maxWidth: 'none' }} className="shrink-0 rounded-md border bg-white object-contain shadow-lg" /> : <Button variant="outline" className={whiteIcon} onClick={() => input.current?.click()}><Upload size={16} />导入图片开始识别</Button>}</div><ScrollBar orientation="horizontal" /></ScrollArea></TabsContent>
    <TabsContent value="result" className="m-0 flex min-h-0 flex-1 flex-col gap-3 p-4 data-[state=inactive]:hidden"><Button variant="outline" size="sm" className="self-end" disabled={!result} onClick={() => void navigator.clipboard.writeText(result).then(() => toast.success('已复制')).catch(e => toast.error(String(e)))}><Copy size={14} />复制文字</Button><Textarea aria-label="识别结果" value={result} onChange={e => setResult(e.target.value)} placeholder="点击开始识别，结果将显示在这里" className="min-h-0 w-full flex-1 resize-none rounded-md border-input bg-background p-3 text-sm leading-6 shadow-sm" /></TabsContent></Tabs>
  </>
  return embedded ? <div className="flex h-full min-h-0 flex-col bg-white">{content}</div> : <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="z-[250] flex w-[min(900px,90vw)] flex-col gap-0 p-0 sm:max-w-none">{content}</SheetContent></Sheet>
}
