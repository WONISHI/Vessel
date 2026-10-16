import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EntryDraft } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/create-entry-shared"
import { FileCode2, FilePlus2, FileText, FolderPlus, LayoutTemplate } from "lucide-react"
import { useState } from "react"

/** Renders the create entry component. */
export function CreateEntry({ kind, onStart }: { kind: EntryDraft["kind"]; onStart: (extension: string) => void }) {
  const [open, setOpen] = useState(false)
  const label = kind === "file" ? "新建文件" : "新建文件夹"
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-stone-500 hover:bg-green-600 hover:text-white"
              aria-label={label}
              onClick={(event) => {
                if (kind === "directory") {
                  event.preventDefault()
                  onStart("")
                }
              }}
            >
              {kind === "file" ? <FilePlus2 className="!size-3.5" /> : <FolderPlus className="!size-3.5" />}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side={kind === "directory" ? "bottom" : "right"}>{label}</TooltipContent>
      </Tooltip>
      {kind === "file" && (
        <PopoverContent
          side="bottom"
          align="end"
          className="w-48 p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {["md", "excalidraw.md", "js", "ts", "json", "jsx", "html", "css", "vue", ""].map((extension) => {
            const itemLabel = extension === "excalidraw.md" ? "新建白板 (.excalidraw.md)" : extension ? `新建 ${extension.toUpperCase()} 文件` : "新建自定义文件"
            return (
              <Button
                key={extension}
                variant="ghost"
                title={itemLabel}
                className="h-8 w-full justify-start gap-2 text-xs hover:bg-green-600 hover:!text-white min-w-0"
                onClick={() => {
                  onStart(extension)
                  setOpen(false)
                }}
              >
                {extension === "md" ? <FileText className="!size-3.5 shrink-0" /> : extension === "excalidraw.md" ? <LayoutTemplate className="!size-3.5 shrink-0" /> : <FileCode2 className="!size-3.5 shrink-0" />}
                <span className="truncate min-w-0 flex-1 text-left">{itemLabel}</span>
              </Button>
            )
          })}
        </PopoverContent>
      )}
    </Popover>
  )
}
