import { codeEditors } from "@/components/core/canvas/variants/code/search-bridge"
import { useEffect, useRef, useState, type RefObject } from "react"
import { Search, ChevronUp, ChevronDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"

/** 搜索活动文件全文；Markdown 优先读取当前编辑内容，其他文本文件从本地读取。 */
export function FileSearch({ path, contentHost }: { path: string; contentHost: RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(0)
  const [matchCase, setMatchCase] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [content, setContent] = useState("")
  const [blocks, setBlocks] = useState<{ text: string; element: HTMLElement }[]>([])
  const [error, setError] = useState("")
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!contentHost.current?.getClientRects().length) return
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.isComposing || event.key.toLowerCase() !== "f") return
      event.preventDefault()
      event.stopPropagation()
      setOpen(true)
      searchInput.current?.focus()
      searchInput.current?.select()
    }
    window.addEventListener("keydown", handleShortcut, true)
    return () => window.removeEventListener("keydown", handleShortcut, true)
  }, [])
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const editor = contentHost.current?.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
    let nextBlocks: { text: string; element: HTMLElement }[] = []
    if (editor) {
      const elements = Array.from(editor.querySelectorAll<HTMLElement>("p,h1,h2,h3,h4,h5,h6,li,td,th,pre")).filter((node) => !node.querySelector("p,li,pre") && !node.closest(".vditor-ir__marker"))
      nextBlocks = elements.map((element) => ({ text: element.innerText || element.textContent || "", element }))
    }
    const code = codeEditors.get(path)
    const request = code ? Promise.resolve(code.getValue()) : editor ? Promise.resolve(editor.innerText) : window.electronAPI.readContent(path)
    request
      .then((text) => {
        if (!cancelled) {
          setContent(text || "")
          setBlocks(nextBlocks)
        }
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [path, open, contentHost])
  const matches = keyword.trim() ? (blocks.length ? blocks.map((block, index) => ({ ...block, line: index + 1 })) : content.split("\n").map((text, index) => ({ text, line: index + 1, element: undefined }))).filter((item) => (() => { const text = matchCase ? item.text : item.text.toLocaleLowerCase(); const term = matchCase ? keyword : keyword.toLocaleLowerCase(); let offset = text.indexOf(term); while (offset >= 0) { if (!wholeWord || (!/[\p{L}\p{N}_]/u.test(text[offset - 1] || " ") && !/[\p{L}\p{N}_]/u.test(text[offset + term.length] || " "))) return true; offset = text.indexOf(term, offset + 1) } return false })()) : []
    const selectMatch = (index: number) => {
    const item = matches[index]
    if (!item) return
    setActive(index)
    const code = codeEditors.get(path)
    if (code) { code.revealLineInCenter(item.line); code.setPosition({ lineNumber: item.line, column: Math.max(1, item.text.toLowerCase().indexOf(keyword.toLowerCase()) + 1) }); return }
    if (item.element?.isConnected) {
      item.element.scrollIntoView({ behavior: "smooth", block: "center" })
      item.element.animate?.([{ backgroundColor: "#bbf7d0" }, { backgroundColor: "transparent" }], { duration: 1800 })
    }
  }
  const move = (direction: number) => selectMatch((active + direction + matches.length) % matches.length)
  const highlight = (text: string) => {
    const index = (matchCase ? text : text.toLowerCase()).indexOf(matchCase ? keyword : keyword.toLowerCase())
    return index < 0 ? text : <>{text.slice(0, index)}<mark className="rounded bg-green-200 text-green-900">{text.slice(index, index + keyword.length)}</mark>{text.slice(index + keyword.length)}</>
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        setError("")
        setContent("")
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="搜索当前文件"
              className="size-7 shrink-0 text-stone-500 hover:bg-emerald-700 hover:text-white"
            >
              <Search className="!size-3.5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          搜索当前文件 <kbd className="ml-2 rounded border px-1 text-[10px]">Ctrl+F</kbd>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        align="end"
        className="w-[372px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border-stone-200 p-0 shadow-[0_18px_50px_#1c19172e]"
      >
        <div className="flex items-center gap-1 px-3 pb-1 pt-2">
          <Search className="size-4 shrink-0 text-stone-400" />
          <input ref={searchInput} autoFocus spellCheck={false} aria-label="文件内容关键词" placeholder="查找当前文件…"
            className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm outline-none"
            value={keyword} onChange={event => { setKeyword(event.target.value); setActive(0) }}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); move(event.shiftKey ? -1 : 1) } }} />
          <span className="text-xs tabular-nums text-stone-400">{matches.length ? Math.min(active + 1, matches.length) : 0}/{matches.length}</span>
          <button className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30" aria-label="上一个匹配" disabled={!matches.length} onClick={() => move(-1)}><ChevronUp size={16} /></button>
          <button className="rounded p-1 text-stone-500 hover:bg-stone-100 disabled:opacity-30" aria-label="下一个匹配" disabled={!matches.length} onClick={() => move(1)}><ChevronDown size={16} /></button>
          <button className="rounded p-1 text-stone-500 hover:bg-stone-100" aria-label="关闭搜索" onClick={() => setOpen(false)}><X size={16} /></button>
        </div>
        <div className="flex gap-2 px-3 pb-2">
          {[{ label: "Aa 区分大小写", value: matchCase, set: setMatchCase }, { label: "全字匹配", value: wholeWord, set: setWholeWord }].map(option => <button key={option.label} aria-pressed={option.value} onClick={() => { option.set(!option.value); setActive(0) }} className={`rounded-md border px-2 py-1 text-xs ${option.value ? "border-green-600 bg-green-50 text-green-700" : "border-stone-200 text-stone-500"}`}>{option.label}</button>)}
        </div>
        {error ? (
          <p
            role="alert"
            className="text-xs text-red-500"
          >
            {error}
          </p>
        ) : (
          <p
            role="status"
            className="border-t bg-stone-50 px-3 py-2 text-xs text-stone-500"
          >
            {keyword ? `找到 ${matches.length} 处匹配内容` : "输入关键词搜索"}
          </p>
        )}
        <ScrollArea className="max-h-64 [&_[data-radix-scroll-area-viewport]]:max-h-64">
          {matches.slice(0, 200).map((item, index) => (
            <button
              type="button"
              key={item.line}
              className={`flex w-full gap-2 break-all border-l-2 px-3 py-2 text-left font-mono text-xs hover:bg-stone-50 ${active === index ? "border-green-600 bg-green-50" : "border-transparent"}`}
              onClick={() => selectMatch(index)}
            >
              <span className="mr-2 text-stone-400">{item.line}</span>
              {highlight(item.text)}
            </button>
          ))}
          {matches.length > 200 && <p className="text-xs text-stone-400">仅显示前 200 行，请缩小搜索范围。</p>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
