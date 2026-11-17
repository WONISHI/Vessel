import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { QuickPickerScrollArea } from "./quick-picker-scroll-area"
import { useFileSearch } from "@/components/workspace-file-picker/hooks/use-file-search"
import type { WorkspaceNode } from "@/components/workspace/types/workspace"
import type { FilePickerWorkspace } from "@/components/workspace-file-picker/types"
import { isQuickOpenPath } from "./searchable-path"
import { VirtualResults } from "./virtual-results"
import { QuickPickerFooter } from "./quick-picker-footer"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope } from "@/features/file-icons/state"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { File, Folder } from "lucide-react"
import { useRef, useState, useMemo, useCallback, useId, type CSSProperties } from "react"

/** Opens current tabs or workspace files matched by name, path, content or a contained link. */
export function WorkspaceFilePicker({ workspace, onClose, popupStyle }: { workspace: FilePickerWorkspace | null; onClose: () => void; popupStyle?: CSSProperties }) {
  const listId = useId()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const bindViewport = useCallback((node: HTMLDivElement | null) => {
    viewportRef.current = node
    setViewport(node)
  }, [])
  const [query, setQuery] = useState("")
  const result = useFileSearch(workspace?.root || "", query)
  const openedMarkdownPaths = useMemo(() => new Set((workspace?.files || []).filter((file) => file.type !== "directory" && /\.(md|markdown)$/i.test(file.path)).map((file) => file.path)), [workspace?.files])
  const files = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase()
    const opened = (workspace?.files || []).filter((file) => isQuickOpenPath(file.path) && (!keyword || file.path.toLocaleLowerCase().includes(keyword)))
    return [...new Map([...opened, ...result.files].map((file) => [file.path, file])).values()]
  }, [workspace?.files, query, result.files])
  const openResult = (file: WorkspaceNode) => {
    if (file.type === "directory") window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: file.path }))
    else workspace?.openFile(file)
    onClose()
  }
  return (
    <FileIconScope.Provider value={workspace?.scope ?? "workspace"}><Dialog
      open
      modal={!popupStyle}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        style={popupStyle}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            if (!files.length) return
            const index = files.findIndex((file) => file.path === selectedPath)
            const next = index < 0 ? (event.key === "ArrowDown" ? 0 : files.length - 1) : Math.max(0, Math.min(files.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))
            setSelectedPath(files[next].path)
            const viewport = viewportRef.current
            if (viewport) {
              const top = next * 30
              if (top < viewport.scrollTop) viewport.scrollTop = top
              else if (top + 30 > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = top + 30 - viewport.clientHeight
              viewport.dispatchEvent(new Event("vessel:quick-picker-reveal"))
            }
          } else if (event.key === "Enter" && selectedPath) {
            const file = files.find((item) => item.path === selectedPath)
            if (file) { event.preventDefault(); openResult(file) }
          }
        }}
        showCloseButton={false}
        overlayClassName="z-[281] bg-black/[.04] backdrop-blur-[3px]"
        className={`workspace-file-picker ${popupStyle ? "vessel-quick-picker" : ""} z-[282] top-[14vh] w-[400px] max-w-[92vw] sm:max-w-[400px] translate-y-0 gap-3 rounded-2xl bg-white p-4 shadow-2xl`}
      >
        <DialogTitle className={popupStyle ? "sr-only" : "text-xs"}>查找工作区文件</DialogTitle>
        <DialogDescription className="sr-only">搜索整个工作区，包含尚未打开的文件；已打开文件优先显示，支持文件夹、文件名、路径、链接与内容。</DialogDescription>
        <Input
          autoFocus
          aria-label="搜索工作区文件"
          placeholder="搜索文件、文件夹、关键词或链接…"
          value={query}
          aria-controls={listId}
          onChange={(event) => {
            setSelectedPath(null)
            setQuery(event.target.value)
            if (viewportRef.current) viewportRef.current.scrollTop = 0
          }}
          className="h-8 text-xs md:text-xs rounded-lg bg-stone-50 focus-visible:border-green-600 focus-visible:ring-green-100 focus-visible:ring-offset-0"
        />
        <p role="status" className="mt-2 px-1 pb-1 text-[10px] text-stone-400">
          {result.busy ? `正在搜索，已找到 ${files.length} 个结果` : `共找到 ${files.length} 个结果`}
          <span className="ml-2">可滚动查看全部结果</span>
        </p>
        <QuickPickerScrollArea
          id={listId}
          viewportRef={bindViewport}
          className="workspace-picker-results min-h-0 w-full max-h-[31.5vh] shrink overflow-hidden [&_[data-radix-scroll-area-viewport]>div]:!block [&_[data-radix-scroll-area-viewport]>div]:min-w-0 [&_[data-radix-scroll-area-viewport]]:max-h-[31.5vh]"
        >
          <VirtualResults items={files} viewport={viewport} getKey={(file) => file.path} renderRow={(file) => (
            <button
              key={file.path}
              data-keyboard-selected={selectedPath === file.path ? "true" : undefined}
              data-active={file.type !== "directory" && workspace?.activePath === file.path ? "true" : undefined}
              aria-current={file.type !== "directory" && workspace?.activePath === file.path ? "page" : undefined}
              className="workspace-file-picker-row flex h-[30px] w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-stone-100 focus:bg-stone-100 focus:outline-none"
              onClick={() => openResult(file)}
            >
              <FileThemeIcon name={file.path} directory={file.type === "directory"} className="size-4 shrink-0 object-contain" fallback={file.type === "directory" ? <Folder aria-hidden className="size-4 shrink-0 text-amber-500" /> : <File aria-hidden className={`size-4 shrink-0 ${getFilePresentation(file.name).color}`} />} />
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span data-title={file.name} className="workspace-file-picker-name max-w-[55%] shrink-0 truncate text-xs leading-4">{file.name}</span>
                <span className="workspace-file-picker-path min-w-0 flex-1 truncate text-[10px] leading-4 text-stone-400">{file.path.startsWith((workspace?.root || "") + "/") ? file.path.slice(workspace!.root.length + 1) : file.path}</span>
              </span>
              {openedMarkdownPaths.has(file.path) && <span className="workspace-file-picker-opened shrink-0 text-[10px]">已打开</span>}
            </button>
          )} />
          {!workspace && <p className="p-3 text-xs text-stone-400">请先打开工作区</p>}
          {workspace && !files.length && <p className="p-3 text-xs text-stone-400">{result.busy ? "正在搜索…" : query.trim() ? "没有匹配的文件" : "工作区暂无文件"}</p>}
        </QuickPickerScrollArea>
        {result.error && (
          <p
            role="alert"
            className="text-xs text-red-600"
          >
            {result.error}
          </p>
        )}
        {result.limited && <p className="text-xs text-stone-400">内容匹配结果较多，请输入更精确的关键词；文件名和文件夹搜索不受此限制。</p>}
        <QuickPickerFooter />
      </DialogContent>
    </Dialog></FileIconScope.Provider>
  )
}
