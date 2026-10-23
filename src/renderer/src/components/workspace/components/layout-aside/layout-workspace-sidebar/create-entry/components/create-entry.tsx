import { fileEntryOptions } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/file-entry-options"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { EntryDraft } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/create-entry-shared"
import { FilePlus2, FolderPlus } from "lucide-react"
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
          {fileEntryOptions.map(({ extension, label: itemLabel, icon: Icon }) => {
            return (
              <Button
                key={extension}
                variant="ghost"
                data-title={itemLabel}
                data-title-side="right"
                className="h-8 w-full justify-start gap-2 text-xs hover:bg-green-600 hover:!text-white min-w-0"
                onClick={() => {
                  onStart(extension)
                  setOpen(false)
                }}
              >
                <Icon className="!size-3.5 shrink-0" />
                <span className="truncate min-w-0 flex-1 text-left">{itemLabel}</span>
              </Button>
            )
          })}
        </PopoverContent>
      )}
    </Popover>
  )
}
