import { useCallback, useMemo, useState, type CSSProperties } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { GitFileIcon } from "./git-file-icon"
import { QuickPickerScrollArea } from "@/components/workspace-file-picker/quick-picker-scroll-area"
import { VirtualResults } from "@/components/workspace-file-picker/virtual-results"
import { QuickPickerFooter } from "@/components/workspace-file-picker/quick-picker-footer"
import { matchesGitFilePath } from "../file-filter"
import type { GitPickerData, GitPickerEntry } from "../file-picker-state"

export function GitFilePicker({ data, open, onClose, popupStyle }: { data: GitPickerData | null; open: boolean; onClose: () => void; popupStyle?: CSSProperties }) {
  const [query, setQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const results = useMemo(() => (data?.entries ?? []).filter(entry => matchesGitFilePath(entry.file.path, query)), [data, query])
  const current = results.findIndex(entry => entry.id === selectedId)
  const selected = current < 0 ? 0 : current
  const choose = (entry: GitPickerEntry) => { data?.select(entry); onClose() }
  const bindViewport = useCallback((node: HTMLDivElement | null) => setViewport(node), [])
  return <Dialog modal={false} open={open} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent style={popupStyle} showCloseButton={false} className="vessel-quick-picker workspace-file-picker z-[282] translate-y-0 gap-3 rounded-2xl bg-white p-4 shadow-2xl" onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const index = Math.max(0, Math.min(results.length - 1, selected + (event.key === "ArrowDown" ? 1 : -1)))
        setSelectedId(results[index]?.id ?? null)
        if (viewport) {
          const top = index * 30
          if (top < viewport.scrollTop) viewport.scrollTo({ top })
          else if (top + 30 > viewport.scrollTop + viewport.clientHeight) viewport.scrollTo({ top: top + 30 - viewport.clientHeight })
          viewport.dispatchEvent(new Event("vessel:quick-picker-reveal"))
        }
      }
      if (event.key === "Enter" && results[selected]) { event.preventDefault(); choose(results[selected]) }
    }}>
      <DialogTitle className="sr-only">搜索 Git 变更文件</DialogTitle>
      <DialogDescription className="sr-only">仅搜索当前仓库的已暂存和工作区变更文件，选择后查看对应差异。</DialogDescription>
      <Input autoFocus aria-label="Git 变更文件关键词" placeholder="搜索暂存和工作区文件名、路径…" value={query} onChange={event => {
        setQuery(event.target.value); setSelectedId(null)
        if (viewport) viewport.scrollTo({ top: 0 })
      }} className="h-8 text-xs" />
      <p role="status" className="mt-2 px-1 pb-1 text-[10px] text-stone-400">共找到 {results.length} 个结果<span className="ml-2">仅暂存和工作区变更</span></p>
      <QuickPickerScrollArea viewportRef={bindViewport} className="workspace-picker-results min-h-0 w-full max-h-[31.5vh] [&_[data-radix-scroll-area-viewport]]:max-h-[31.5vh]">
        <VirtualResults items={results} viewport={viewport} getKey={entry => entry.id} renderRow={entry => <button type="button" aria-selected={entry.id === results[selected]?.id} data-keyboard-selected={entry.id === results[selected]?.id ? "true" : undefined} className="workspace-file-picker-row flex h-[30px] w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 focus:bg-stone-100 focus:outline-none" onClick={() => choose(entry)}>
          <span className="quick-picker-icon"><GitFileIcon path={entry.file.path} className="size-4 shrink-0" /></span>
          <span className="flex min-w-0 flex-1 items-baseline gap-2"><span className="workspace-file-picker-name max-w-[55%] shrink-0 truncate text-xs leading-4">{entry.file.path.split(/[\\/]/).at(-1)}</span><span className="workspace-file-picker-path min-w-0 flex-1 truncate text-[10px] leading-4 text-stone-400">{entry.file.path}</span></span>
          <span className="shrink-0 text-[10px] text-stone-500">{entry.section === "staged" ? "已暂存" : entry.section === "conflicts" ? "工作区 · 冲突" : "工作区"}</span>
        </button>} />
        {!results.length && <p className="quick-picker-empty">{query.trim() ? "没有匹配的变更文件" : "暂无暂存或工作区变更文件"}</p>}
      </QuickPickerScrollArea>
      <QuickPickerFooter action="查看差异" />
    </DialogContent>
  </Dialog>
}
