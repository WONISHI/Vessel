import { useId, useRef, useState, useEffect, type ComponentProps } from 'react'
import { createPortal } from 'react-dom'
import { Search, CornerDownLeft, Globe } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { HistoryEntry } from '../../../../shared/browser-tools'
import './history-input.css'

function Highlight({ text, query }: { text: string; query: string }) {
  const index = text.toLowerCase().indexOf(query.toLowerCase())
  return index < 0 || !query ? <>{text}</> : <>{text.slice(0, index)}<mark>{text.slice(index, index + query.length)}</mark>{text.slice(index + query.length)}</>
}
export function HistoryInput({ onNavigate, ...props }: ComponentProps<'input'> & { onNavigate: (value: string, newTab?: boolean) => void }) {
  const id = useId(), ref = useRef<HTMLInputElement>(null)
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [open, setOpen] = useState(false), [active, setActive] = useState(0)
  const [rect, setRect] = useState({ left: 0, top: 0, width: 0 })
  const query = String(props.value ?? '').trim()
  const matches = [...new Map(entries.filter(entry => `${entry.title} ${entry.url}`.toLowerCase().includes(query.toLowerCase())).map(entry => [entry.url, entry])).values()].slice(0, 8)
  const count = matches.length + 1
  const show = open && !!query
  useEffect(() => {
    if (!show) return
    const position = () => { const bounds = ref.current?.closest('form')?.getBoundingClientRect(); if (bounds) setRect({ left: bounds.left, top: bounds.bottom + 6, width: bounds.width }) }
    position(); window.addEventListener('resize', position); window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [show])
  const choose = (index: number, newTab = false) => { onNavigate(matches[index]?.url ?? query, newTab); setOpen(false) }
  return <><input {...props} ref={ref} role="combobox" aria-autocomplete="list" aria-expanded={show} aria-controls={show ? id : undefined} aria-activedescendant={show ? `${id}-${Math.min(active, count - 1)}` : undefined} autoComplete="off"
    onChange={event => { props.onChange?.(event); setActive(0); setOpen(true) }}
    onFocus={event => { props.onFocus?.(event); setOpen(true); void window.electronAPI.listBrowserHistory().then(setEntries).catch(() => setEntries([])) }}
    onBlur={event => { props.onBlur?.(event); setOpen(false) }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if (show && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + count) % count; setActive(next); document.getElementById(`${id}-${next}`)?.scrollIntoView({ block: 'nearest' }); return }
      if (show && event.key === 'Enter') { event.preventDefault(); choose(Math.min(active, count - 1), event.metaKey || event.ctrlKey); return }
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return }
      props.onKeyDown?.(event)
    }} />{show && createPortal(<div className="history-completion" style={{ left: rect.left, top: rect.top, width: rect.width }} onMouseDown={event => event.preventDefault()}>
      <div className="history-completion-heading">历史记录<span>{matches.length} 条</span></div>
      <ScrollArea className="[&_[data-radix-scroll-area-viewport]>div]:!block max-h-[min(340px,45vh)] [&_[data-radix-scroll-area-viewport]]:max-h-[min(340px,45vh)]"><div role="listbox" id={id}>
        {matches.map((entry, index) => <div role="option" aria-selected={index === active} id={`${id}-${index}`} key={entry.url} className="history-completion-item" onMouseEnter={() => setActive(index)} onClick={event => choose(index, event.metaKey || event.ctrlKey)}>
          <span className="history-site-icon"><Globe size={17} /></span><span className="history-completion-copy"><strong><Highlight text={entry.title || entry.url} query={query} /></strong><small><Highlight text={entry.url.replace(/^https?:\/\//, '')} query={query} /></small></span><span className={entry.bookmarked ? 'history-badge bookmark' : 'history-badge'}>{entry.bookmarked ? '书签' : '历史'}</span>{index === active && <CornerDownLeft size={12} />}
        </div>)}
        <div className="history-completion-heading">搜索建议<span>Bing</span></div>
        <div role="option" aria-selected={active === matches.length} id={`${id}-${matches.length}`} className="history-completion-item" onMouseEnter={() => setActive(matches.length)} onClick={() => choose(matches.length)}><Search size={18} /><span className="history-completion-copy"><Highlight text={query} query={query} /></span><span className="history-search-label">Bing 搜索</span></div>
      </div></ScrollArea><footer>↑↓ 选择 · ↵ 打开 · ⌘/Ctrl ↵ 新标签 · Esc 关闭<span>共 {count} 条结果</span></footer>
    </div>, document.body)}</>
}
