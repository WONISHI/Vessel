import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFileSearch } from "@/components/workspace-file-picker/hooks/use-file-search"
import type { FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { File, Folder } from "lucide-react"
import { useRef, useState } from "react"

/** Opens current tabs or workspace files matched by name, path, content or a contained link. */
export function WorkspaceFilePicker({ workspace, onClose }: { workspace: FilePickerWorkspace | null; onClose: () => void }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [visibleCount, setVisibleCount] = useState(100)
  const result = useFileSearch(workspace?.root || "", query)
  const keyword = query.trim().toLocaleLowerCase()
  const openFiles = (workspace?.files || []).filter((file) => !keyword || file.path.toLocaleLowerCase().includes(keyword))
  const files = [...new Map([...openFiles, ...result.files].map((file) => [file.path, file])).values()]
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[281] bg-black/[.04] backdrop-blur-[3px]"
        className="workspace-file-picker z-[282] top-[14vh] w-[400px] max-w-[92vw] sm:max-w-[400px] translate-y-0 gap-3 rounded-2xl bg-white p-4 shadow-2xl"
      >
        <DialogTitle className="text-xs">查找工作区文件</DialogTitle>
        <DialogDescription className="sr-only">搜索整个工作区，包含尚未打开的文件；已打开文件优先显示，支持文件夹、文件名、路径、链接与内容。</DialogDescription>
        <Input
          autoFocus
          aria-label="搜索工作区文件"
          placeholder="搜索文件、文件夹、关键词或链接…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setVisibleCount(100)
            if (viewportRef.current) viewportRef.current.scrollTop = 0
          }}
          className="h-8 text-xs md:text-xs rounded-lg bg-stone-50 focus-visible:border-green-600 focus-visible:ring-green-100 focus-visible:ring-offset-0"
        />
        <p role="status" className="text-xs text-stone-400">
          {result.busy ? `正在搜索，已找到 ${files.length} 个结果` : `共找到 ${files.length} 个结果`}
          <span className="ml-2">已显示 {Math.min(visibleCount, files.length)} 个</span>
        </p>
        <ScrollArea
          viewportRef={viewportRef}
          onScrollCapture={(event) => {
            const viewport = viewportRef.current
            if (event.target !== viewport || !viewport || visibleCount >= files.length) return
            if (viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 40) {
              setVisibleCount((count) => Math.min(count + 100, files.length))
            }
          }}
          className="max-h-[45vh] min-h-0 [&_[data-radix-scroll-area-viewport]]:max-h-[45vh]"
        >
          {files.slice(0, visibleCount).map((file) => (
            <button
              key={file.path}
              className="workspace-file-picker-row flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 focus:bg-stone-100 focus:outline-none"
              onClick={() => {
                if (file.type === "directory") window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: file.path }))
                else workspace?.openFile(file)
                onClose()
              }}
            >
              {file.type === "directory" ? (
                <Folder
                  aria-hidden
                  className="size-4 shrink-0 text-amber-500"
                />
              ) : (
                <File
                  aria-hidden
                  className="size-4 shrink-0 text-stone-400"
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span data-title={file.name} className="workspace-file-picker-name truncate text-xs leading-4">{file.name}</span>
                <span className="workspace-file-picker-path w-full truncate text-[10px] leading-4 text-stone-400">{file.path.startsWith((workspace?.root || "") + "/") ? file.path.slice(workspace!.root.length + 1) : file.path}</span>
              </span>
            </button>
          ))}
          {files.length > visibleCount && <p className="py-2 text-center text-xs text-stone-400">继续向下滚动加载更多</p>}
          {!workspace && <p className="p-3 text-xs text-stone-400">请先打开工作区</p>}
          {workspace && !files.length && <p className="p-3 text-xs text-stone-400">{result.busy ? "正在搜索…" : query.trim() ? "没有匹配的文件" : "工作区暂无文件"}</p>}
        </ScrollArea>
        {result.error && (
          <p
            role="alert"
            className="text-xs text-red-600"
          >
            {result.error}
          </p>
        )}
        {result.limited && <p className="text-xs text-stone-400">内容匹配结果较多，请输入更精确的关键词；文件名和文件夹搜索不受此限制。</p>}
      </DialogContent>
    </Dialog>
  )
}
