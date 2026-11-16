import type { ClipboardEntry, ClipboardHistoryAPI, ClipboardKind, ClipboardState } from "@vessel/type"
import Logo from "@/assets/logo-dark.svg"
import { Check, Clipboard, Copy, Ellipsis, File, Globe, Image, Pause, Pin, Play, Search, Trash2, Type, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"

declare global { interface Window { clipboardAPI: ClipboardHistoryAPI } }
const kinds: { value?: ClipboardKind; label: string; color?: string }[] = [
  { label: "全部" }, { value: "text", label: "文本", color: "#a18aff" },
  { value: "image", label: "图片", color: "#36c58c" }, { value: "link", label: "链接", color: "#5aa7ff" },
  { value: "color", label: "颜色", color: "#b9abbc" }, { value: "files", label: "文件", color: "#ff9277" }
]
const icons = { text: Type, image: Image, link: Globe, color: Copy, files: File }
const timeLabel = (time: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - time) / 60000))
  return minutes < 1 ? "刚刚" : minutes < 60 ? `${minutes} 分钟前` : minutes < 1440 ? `${Math.floor(minutes / 60)} 小时前` : `${Math.floor(minutes / 1440)} 天前`
}
const sizeLabel = (size: number) => size >= 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`

function ClipCard({ entry, index, active, now, select, copy, pin, remove }: { entry: ClipboardEntry; index: number; active: boolean; now: number; select: () => void; copy: () => void; pin: () => void; remove: () => void }) {
  const kind = kinds.find((kind) => kind.value === entry.kind)!
  const Icon = icons[entry.kind]
  const cardRef = useRef<HTMLElement>(null)
  useEffect(() => { if (active) cardRef.current?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }) }, [active])
  const detail = entry.kind === "image" ? sizeLabel(entry.size) : entry.kind === "files" ? `${entry.files.length || 1} 个文件` : `${entry.characters.toLocaleString()} 个字符`
  return <article ref={cardRef} className={`clip-card${active ? " is-selected" : ""}`} aria-label={`${kind.label}：${entry.preview.slice(0, 80) || "剪贴板图片"}`} style={{ "--kind-color": kind.color } as React.CSSProperties}>
    <span className="clip-kind">{kind.label}</span>
    <header className="clip-card-header">
      <span className="clip-number">{index < 9 ? `${navigator.platform.includes("Mac") ? "⌘" : "Ctrl+"}${index + 1}` : String(index + 1).padStart(2, "0")}</span>
      <div className="clip-card-actions">
        <button title="复制这条记录" aria-label="复制这条记录" onClick={copy}><Copy size={14} /></button>
        <button title={entry.pinned ? "取消固定记录" : "固定记录"} aria-label={entry.pinned ? "取消固定记录" : "固定记录"} className={entry.pinned ? "is-pinned" : ""} onClick={pin}><Pin size={14} fill={entry.pinned ? "currentColor" : "none"} /></button>
        <button title="删除记录" aria-label="删除记录" onClick={remove}><Trash2 size={14} /></button>
      </div>
    </header>
    <button className="clip-content" aria-pressed={active} onClick={select} onDoubleClick={copy}>
      {entry.kind === "image" ? <div className="clip-image">{entry.thumbnail && <img src={entry.thumbnail} alt="剪贴板图片预览" />}</div>
        : entry.kind === "color" ? <div className="clip-color"><span style={{ background: entry.preview.trim() }} /><strong>{entry.preview.trim()}</strong></div>
          : entry.kind === "files" ? <div className="clip-files">{(entry.files.length ? entry.files : [entry.preview]).slice(0, 4).map((file, index) => <div key={index}><File size={25} /><span>{file.split(/[\\/]/).pop()}</span></div>)}{entry.files.length > 4 && <small>另有 {entry.files.length - 4} 个文件</small>}</div>
            : <div className={`clip-text${entry.kind === "link" ? " clip-link" : ""}`}>{entry.kind === "link" && <Globe size={25} />}<p>{entry.preview}</p></div>}
    </button>
    <footer className="clip-card-footer"><Icon size={14} /><span>{timeLabel(entry.createdAt, now)}<b>·</b>{detail}</span>{entry.pinned && <Pin className="clip-fixed-mark" size={12} fill="currentColor" />}</footer>
  </article>
}

/** A small independent renderer, without loading the workspace or browser UI. */
export function ClipboardPanel() {
  const [state, setState] = useState<ClipboardState>()
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<ClipboardKind>()
  const [pinnedOnly, setPinnedOnly] = useState(false)
  const [selected, setSelected] = useState<number>()
  const [revision, setRevision] = useState(0)
  const [menu, setMenu] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now)
  const searchRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const entries = state?.entries || []
  const active = entries.find((entry) => entry.id === selected) || entries[0]
  const api = window.clipboardAPI
  const mac = navigator.platform.includes("Mac")

  useEffect(() => {
    if (!api) return
    const stop = api.onChange(() => setRevision((value) => value + 1))
    const show = api.onShow(() => {
      setQuery(""); setKind(undefined); setPinnedOnly(false); setSelected(undefined); setMenu(false); setMessage("")
      setRevision((value) => value + 1)
      requestAnimationFrame(() => { searchRef.current?.focus(); searchRef.current?.select() })
    })
    const timer = setInterval(() => setNow(Date.now()), 60000)
    searchRef.current?.focus()
    return () => { stop(); show(); clearInterval(timer) }
  }, [api])
  useEffect(() => {
    if (!api) return
    let disposed = false
    const timer = setTimeout(() => {
      void api.state({ query, kind, pinnedOnly }).then((value) => { if (!disposed) setState(value) }).catch((error) => { if (!disposed) setMessage(String(error)) })
    }, query ? 120 : 0)
    return () => { disposed = true; clearTimeout(timer) }
  }, [api, query, kind, pinnedOnly, revision])
  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false) }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [menu])

  const run = async (action: () => Promise<unknown>, success = "") => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try { await action(); setMessage(success) } catch (error) { setMessage(error instanceof Error ? error.message : String(error)) }
    finally { busyRef.current = false; setBusy(false) }
  }
  const copy = (entry: ClipboardEntry | undefined, plainText = false) => {
    if (entry) void run(() => api.copy(entry.id, plainText), `已复制，可使用 ${mac ? "⌘V" : "Ctrl+V"} 粘贴`)
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing) return
      if (event.key === "Escape") { event.preventDefault(); if (menu) setMenu(false); else void api?.close(); return }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") { event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return }
      if ((mac ? event.metaKey : event.ctrlKey) && /^[1-9]$/.test(event.key)) { event.preventDefault(); copy(entries[Number(event.key) - 1]); return }
      const input = event.target instanceof HTMLElement && !!event.target.closest("input,textarea")
      if ((event.key === "ArrowRight" || event.key === "ArrowLeft") && (!input || !query)) {
        event.preventDefault()
        const index = entries.findIndex((entry) => entry.id === active?.id)
        const next = entries[(index + (event.key === "ArrowRight" ? 1 : -1) + entries.length) % entries.length]
        if (next) setSelected(next.id)
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const index = entries.findIndex((entry) => entry.id === active?.id)
        const next = entries[(index + (event.key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length]
        if (next) setSelected(next.id)
      }
      if (event.key === "Enter" && (input || event.target === document.body)) { event.preventDefault(); copy(active, event.shiftKey) }
    }
    window.addEventListener("keydown", keydown)
    return () => window.removeEventListener("keydown", keydown)
  })

  if (!api) return <div className="clipboard-boot">请在 Vessel 中使用 Control+V 打开剪贴板。</div>
  return <main className="clipboard-shell" aria-label="Vessel 剪贴板历史" aria-busy={busy}>
    <header className="clipboard-toolbar">
      <div className="clipboard-brand" title="Vessel 剪贴板"><img src={Logo} alt="Vessel" /><span>剪贴板</span></div>
      <div className="clipboard-controls">
        <label className="clipboard-search"><Search size={17} /><input ref={searchRef} type="search" aria-label="搜索剪贴板" placeholder="搜索剪贴板" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>{mac ? "⌘ F" : "Ctrl F"}</kbd></label>
        <nav className="clipboard-filters" aria-label="内容类型">{kinds.map((item) => <button key={item.value || "all"} aria-pressed={kind === item.value && !pinnedOnly} onClick={() => { setKind(item.value); setPinnedOnly(false); setSelected(undefined) }} className={kind === item.value && !pinnedOnly ? "is-active" : ""}>{item.color && <i style={{ background: item.color }} />}{item.label}</button>)}</nav>
      </div>
      <div className="clipboard-tools">
        <button title="只看固定记录" aria-label="只看固定记录" aria-pressed={pinnedOnly} className={pinnedOnly ? "is-active" : ""} onClick={() => setPinnedOnly((value) => !value)}><Pin size={17} /></button>
        <button title="保持面板展开" aria-label="保持面板展开" aria-pressed={!!state?.keepOpen} className={state?.keepOpen ? "is-active" : ""} onClick={() => void run(() => api.keepOpen(!state?.keepOpen))}><Clipboard size={17} /></button>
        <div ref={menuRef} className="clipboard-menu-anchor">
          <button title="更多操作" aria-label="更多操作" aria-expanded={menu} onClick={() => { setMenu((value) => !value); setConfirmClear(false) }}><Ellipsis size={20} /></button>
          {menu && <div className="clipboard-menu" role="menu">
            <button role="menuitem" onClick={() => { void run(() => api.pause(!state?.paused)); setMenu(false) }}>{state?.paused ? <Play size={15} /> : <Pause size={15} />}{state?.paused ? "继续记录复制内容" : "暂停记录复制内容"}</button>
            <button role="menuitem" disabled={!active || active.kind === "image"} onClick={() => { copy(active, true); setMenu(false) }}><Type size={15} />复制选中项为纯文本</button>
            <div className="clipboard-menu-divider" />
            <button role="menuitem" className="is-danger" onClick={() => { if (!confirmClear) { setConfirmClear(true); return } void run(() => api.clear()); setMenu(false) }}>{confirmClear ? <Check size={15} /> : <Trash2 size={15} />}{confirmClear ? "确认清空（保留固定记录）" : "清空未固定记录"}</button>
          </div>}
        </div>
        <button title="关闭 · Esc" aria-label="关闭剪贴板" onClick={() => void api.close()}><X size={17} /></button>
      </div>
    </header>
    <section className="clipboard-cards" aria-label="复制历史" onWheel={(event) => { if (!event.deltaX) event.currentTarget.scrollLeft += event.deltaY }}>{entries.map((entry, index) => <ClipCard key={entry.id} entry={entry} index={index} active={entry.id === active?.id} now={now} select={() => setSelected(entry.id)} copy={() => copy(entry)} pin={() => void run(() => api.pin(entry.id))} remove={() => void run(() => api.remove(entry.id))} />)}
      {!entries.length && <div className="clipboard-empty"><Clipboard size={30} strokeWidth={1.25} /><strong>{!state ? "正在读取剪贴板" : query || kind || pinnedOnly ? "没有找到匹配的记录" : "复制一点内容，留在这里"}</strong><span>{state?.paused ? "记录已暂停，可在右上角继续记录" : query || kind || pinnedOnly ? "试试其他关键词或切换内容类型" : "在任意应用中复制文本、图片或文件后，即可在这里找到"}</span></div>}
    </section>
    <footer className="clipboard-footer"><span className="clipboard-status" role="status">{message || (state?.paused ? <><Pause size={11} />记录已暂停</> : <><i />{query || kind || pinnedOnly ? `${entries.length} 条匹配` : `${state?.total || 0} 条记录`}<b>·</b>保存在本机</>)}</span><span className="clipboard-key-hints"><kbd>←</kbd><kbd>→</kbd> 选择 <span /><kbd>↵</kbd> 复制 <span /><kbd>{mac ? "⌘V" : "Ctrl+V"}</kbd> 粘贴 <span /><kbd>esc</kbd> 收起</span></footer>
    {state && !state.shortcutRegistered && <div className="clipboard-shortcut-warning">{state.shortcut} 未注册成功，请检查快捷键占用或系统辅助功能权限。仍可从「编辑 → 剪贴板历史」打开。</div>}
  </main>
}
