import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFileSearch } from "@/components/workspace-file-picker/hooks/use-file-search"
import type { FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { File, Folder } from "lucide-react"
import { useState } from "react"

/** Opens current tabs or workspace files matched by name, path, content or a contained link. */
export function WorkspaceFilePicker({ workspace, onClose }: { workspace: FilePickerWorkspace | null; onClose: () => void }) {
  const [query, setQuery] = useState("")
  const result = useFileSearch(workspace?.root || "", query)
  const files = query.trim() ? result.files : workspace?.files || []
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
        className="workspace-file-picker z-[282] top-[14vh] max-w-lg translate-y-0 gap-3 rounded-2xl bg-white p-4 shadow-2xl"
      >
        <DialogTitle className="text-xs">查找工作区文件</DialogTitle>
        <DialogDescription className="sr-only">默认显示当前打开的文件，输入关键词搜索文件夹、文件名、路径或文件中的链接与内容。</DialogDescription>
        <Input
          autoFocus
          aria-label="搜索工作区文件"
          placeholder="搜索文件、文件夹、关键词或链接…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 text-xs md:text-xs rounded-lg bg-stone-50 focus-visible:border-green-600 focus-visible:ring-green-100 focus-visible:ring-offset-0"
        />
        <p className="text-xs text-stone-400">{query.trim() ? "工作区搜索结果" : "当前打开的文件"}</p>
        <ScrollArea className="max-h-[45vh] min-h-0 [&_[data-radix-scroll-area-viewport]]:max-h-[45vh]">
          {files.slice(0, 100).map((file) => (
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
                <span className="workspace-file-picker-name truncate text-xs leading-4">{file.name}</span>
                <span className="workspace-file-picker-path w-full truncate text-[10px] leading-4 text-stone-400">{file.path.startsWith((workspace?.root || "") + "/") ? file.path.slice(workspace!.root.length + 1) : file.path}</span>
              </span>
            </button>
          ))}
          {!workspace && <p className="p-3 text-xs text-stone-400">请先打开工作区</p>}
          {workspace && !files.length && <p className="p-3 text-xs text-stone-400">{result.busy ? "正在搜索…" : query.trim() ? "没有匹配的文件" : "暂无打开的文件"}</p>}
        </ScrollArea>
        {result.error && (
          <p
            role="alert"
            className="text-xs text-red-600"
          >
            {result.error}
          </p>
        )}
        {(result.limited || files.length > 100) && <p className="text-xs text-stone-400">结果较多，请输入更精确的关键词</p>}
      </DialogContent>
    </Dialog>
  )
}
