import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from "@/components/ui/alert-dialog"
import { useRef, useState } from "react"
import { FilePlus2, FolderPlus, FileCode2, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

export interface EntryDraft {
  parent: string
  kind: "file" | "directory"
  extension: string
}
/** 悬停选择文件格式，名称在目录树中填写。 */
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
          className="w-40 p-1"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          {["md", "js", "ts", "json", "jsx", "html", "css", "vue", ""].map((extension) => (
            <Button
              key={extension}
              variant="ghost"
              className="h-8 w-full justify-start text-xs hover:bg-green-600 hover:!text-white"
              onClick={() => {
                onStart(extension)
                setOpen(false)
              }}
            >
              {extension === "md" ? <FileText className="!size-3.5" /> : <FileCode2 className="!size-3.5" />}
              {extension ? `新建 ${extension.toUpperCase()} 文件` : "新建自定义文件"}
            </Button>
          ))}
        </PopoverContent>
      )}
    </Popover>
  )
}

/** Enter 提交、Escape 取消；完整文件名和后缀均可修改，失败允许重试。 */
export function InlineEntryEditor({ draft, onFinish }: { draft: EntryDraft; onFinish: (created: boolean) => void }) {
  const { workspace, openWorkspaceFile } = useWorkspace()
  const [name, setName] = useState(draft.kind === "file" && draft.extension ? `未命名.${draft.extension}` : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const cancelled = useRef(false)
  const submit = async () => {
    if (submitting.current || cancelled.current) return
    if (!name.trim()) { cancelled.current = true; onFinish(false); return }
    submitting.current = true
    setBusy(true)
    setError("")
    try {
      const node = await window.electronAPI.createWorkspaceEntry(workspace.path, draft.parent, name.trim(), draft.kind)
      onFinish(true)
      if (draft.kind === "file") openWorkspaceFile(node)
    } catch (reason) {
      setError(String(reason).replace(/^Error: Error invoking remote method '[^']+': (?:Error: )?/, ""))
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <form
      className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-1 pr-2"
      onSubmit={event => { event.preventDefault(); void submit() }}    >
      <div className="flex min-w-0 flex-1 items-center rounded-sm border border-green-600 bg-transparent px-1.5 "><input
        placeholder="未命名"
        autoFocus
        onFocus={event => event.target.select()}
        aria-label={draft.kind === "file" ? "新文件名称" : "新文件夹名称"}
        className="h-6 min-w-0 flex-1 !rounded-none !border-0 !bg-transparent p-0 text-xs !shadow-none !outline-none !ring-0"
        onBlur={() => { if (!error) void submit() }}
        value={name}
        disabled={busy}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) { cancelled.current = true; onFinish(false) }
        }}
        title={error || undefined}
        aria-invalid={!!error}
      />
      </div>
      <AlertDialog open={!!error} onOpenChange={open => { if (!open) setError("") }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>无法创建</AlertDialogTitle><AlertDialogDescription>{error}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogAction>知道了</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
