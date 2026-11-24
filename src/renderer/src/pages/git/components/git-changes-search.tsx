import { useState } from "react"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function GitChangesSearch({ query, onChange, label }: { query: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button type="button" variant="ghost" size="icon" className="git-changes-action size-7 rounded-md" aria-label={`搜索${label}`} data-title={`搜索${label}`} data-title-side="bottom" data-filtered={Boolean(query.trim())}>
        <Search className="size-4" strokeWidth={1.75} />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" side="bottom" sideOffset={6} className="flex w-64 items-center gap-1 rounded-xl p-2">
      <Input autoFocus aria-label={`搜索${label}关键词`} placeholder="搜索文件名或路径…" value={query} onChange={event => onChange(event.target.value)} onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onChange(""); setOpen(false) }
      }} className="h-8 min-w-0 flex-1 text-xs" />
      {query && <Button type="button" variant="ghost" size="icon" className="git-changes-action size-7 shrink-0 rounded-lg" aria-label={`清空${label}搜索`} onClick={() => onChange("")}><X className="size-3.5" /></Button>}
    </PopoverContent>
  </Popover>
}
