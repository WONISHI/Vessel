import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope } from "@/features/file-icons/state"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { addTransit, addTransitFile, deleteTransit, selectTransit, useTransit } from "@/components/transit/state"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClipboardPaste, File, FileText, Globe, Pin, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the transit button component. */
export function TransitButton() {
  const { items, selected } = useTransit()
  const [open, setOpen] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-transit-button="true"
          data-title="中转站"
          aria-pressed={Boolean(selected)}
          aria-label="中转站"
          className="relative !size-6 rounded text-stone-500 hover:bg-stone-200 hover:text-stone-500 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-400"
        >
          <Pin className="!size-4" />
          {items.length > 0 && <span aria-hidden="true" className="pointer-events-none absolute -right-1.5 top-0 min-w-3 rounded-full bg-green-600 px-0.5 text-center text-[9px] leading-3 text-white">{items.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        side="bottom"
        align="end"
        sideOffset={10}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="z-[310] w-[280px] overflow-hidden rounded-xl border-stone-200 bg-white p-0 text-stone-800 shadow-xl"
      >
        <div className="flex items-center gap-2 border-b px-3 py-2.5 text-sm font-semibold">
          <Pin className="size-4 text-green-600" />
          中转站<span className="ml-auto rounded-full bg-stone-100 px-2 text-xs font-normal text-stone-400">{items.length} 个</span>
        </div>
        <ScrollArea className="max-h-[280px] p-1 [&_[data-radix-scroll-area-viewport]]:max-h-[272px] [&_[data-radix-scroll-area-viewport]>div]:!block">
          {!items.length && <p className="px-3 py-6 text-center text-xs text-stone-400">暂无内容，读取剪贴板添加链接或文字</p>}
          {items.map((item) => (
            <div
              key={item.id}
              data-dark-list-item
              data-active={selected === item.id}
              className={`group flex min-h-[30px] min-w-0 items-center gap-2 rounded-[2px] px-2 py-0 ${selected === item.id ? "bg-emerald-50 text-green-700" : "hover:bg-[#f0efed]"}`}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => {
                  selectTransit(item.id)
                  setOpen(false)
                }}
              >
                <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
                  {item.kind === "file" ? <FileIconScope.Provider value="workspace"><FileThemeIcon name={item.content} className="size-4 shrink-0 object-contain" fallback={<File className={`size-4 ${getFilePresentation(item.content).color}`} />} /></FileIconScope.Provider> : item.kind === "url" ? <Globe className="size-4 text-green-600" /> : <FileText className="size-4 text-stone-400" />}
                </span>
                <span className="dark-list-title min-w-0 flex-1 truncate text-xs font-normal" data-title={item.title} data-title-side="left">{item.title}</span>
              </button>
              <button
                aria-label={`删除 ${item.title}`}
                data-title="删除"
                className="shrink-0 rounded p-1 text-stone-400 opacity-0 hover:bg-stone-200 hover:text-red-600 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  // Keep focus inside the popover before removing the focused row.
                  // Otherwise Radix treats the resulting focus on the page as dismissal.
                  contentRef.current?.focus({ preventScroll: true })
                  try {
                    deleteTransit(item.id)
                  } catch {
                    toast.error("删除失败，无法保存列表")
                  }
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </ScrollArea>
        <button
          className="transit-read-clipboard flex w-full items-center gap-2 border-t px-3 py-2.5 text-xs text-stone-500 hover:bg-stone-50 hover:text-green-600"
          onClick={() => {
            void window.electronAPI
              .importTransitFiles()
              .then((files) => {
                files.forEach((file) => addTransitFile(file.root, file.path, file.title))
                if (files.length) setOpen(false)
              })
              .catch((error) => toast.error(String(error)))
          }}
        >
          <Upload className="size-4" />
          导入文件
        </button>
        <button
          className="transit-read-clipboard flex w-full items-center gap-2 border-t px-3 py-2.5 text-xs text-stone-500 hover:bg-stone-50 hover:text-green-600"
          onClick={() => {
            void window.electronAPI
              .readTransitClipboard()
              .then((value) => {
                if (typeof value === "string") addTransit(value)
                else addTransitFile(value.root, value.path, value.title)
                setOpen(false)
              })
              .catch((error) => toast.error(String(error)))
          }}
        >
          <ClipboardPaste className="size-4" />
          读取剪贴板
        </button>
      </PopoverContent>
    </Popover>
  )
}
