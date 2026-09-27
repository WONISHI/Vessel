import { useEffect, useRef, useState, type RefObject } from "react"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"

/** 搜索活动文件全文；Markdown 优先读取当前编辑内容，其他文本文件从本地读取。 */
export function FileSearch({ path, contentHost }: { path: string; contentHost: RefObject<HTMLDivElement | null> }) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState("")
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.isComposing || event.key.toLowerCase() !== "f") return
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
    const request = editor ? Promise.resolve(editor.innerText) : window.electronAPI.readContent(path)
    request
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [path, open, contentHost])
  const matches = keyword.trim()
    ? content
        .split("\n")
        .map((text, index) => ({ text, line: index + 1 }))
        .filter((item) => item.text.toLocaleLowerCase().includes(keyword.toLocaleLowerCase()))
    : []
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
        align="end"
        className="w-64 space-y-2 p-3"
      >
        <Input
          ref={searchInput}
          className="!h-7 rounded-md px-2 py-1 text-xs shadow-none focus-visible:ring-1 focus-visible:ring-green-600"
          autoFocus
          type="search"
          aria-label="文件内容关键词"
          placeholder="搜索当前文件内容…"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
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
            className="text-xs text-stone-500"
          >
            {keyword ? `找到 ${matches.length} 行匹配内容` : "输入关键词搜索"}
          </p>
        )}
        <ScrollArea className="max-h-64 [&_[data-radix-scroll-area-viewport]]:max-h-64">
          {matches.slice(0, 200).map((item) => (
            <p
              key={item.line}
              className="break-all border-b py-2 text-xs"
            >
              <span className="mr-2 text-stone-400">{item.line}</span>
              {item.text}
            </p>
          ))}
          {matches.length > 200 && <p className="text-xs text-stone-400">仅显示前 200 行，请缩小搜索范围。</p>}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
