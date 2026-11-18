import { useDirectoryTreeLayout } from "@/features/directory-tree/state"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope } from "@/features/file-icons/state"
import { fileTreeRowStyle } from "../../tree-layout"
import { createMindmapDocument } from "@/components/core/canvas/variants/mindmap/document"
import { createMarkdownTableDocument } from "@/components/core/canvas/variants/markdown-table/document"
import { createNewExcalidrawContent } from "@/components/core/canvas/variants/excalidraw/parser"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { EntryDraft } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/create-entry-shared"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import { File, Folder } from "lucide-react"
import { useCallback, useContext, useEffect, useRef, useState } from "react"

/** Renders the inline entry editor component. */
export function InlineEntryEditor({ draft, onFinish }: { draft: EntryDraft; onFinish: (created: boolean) => void }) {
  const layout = useDirectoryTreeLayout()
  const resourceStyle = useContext(FileIconScope) === "resources"
  const rowStyle = fileTreeRowStyle(layout, true)
  const { workspace, openWorkspaceFile } = useWorkspace()
  const suffix = draft.kind === "file" && draft.extension ? `.${draft.extension}` : ""
  const [name, setName] = useState(suffix ? `未命名${resourceStyle ? suffix : ""}` : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const touched = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputHeight = resourceStyle ? layout.rowHeight - 4 : Math.min(26, layout.rowHeight - 4)

  const selectName = useCallback((input: HTMLInputElement) => {
    if (resourceStyle && draft.kind === "file") {
      const extensionStart = suffix && input.value.toLowerCase().endsWith(suffix.toLowerCase()) ? input.value.length - suffix.length : input.value.lastIndexOf(".")
      input.setSelectionRange(0, extensionStart > 0 ? extensionStart : input.value.length)
    } else input.select()
  }, [resourceStyle, draft.kind, suffix])

  /** Focuses input. */
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input
    if (input) {
      input.focus({ preventScroll: true })
      selectName(input)
    }
  }, [selectName])

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus({ preventScroll: true })
      selectName(el)
    }
    const raf = requestAnimationFrame(() => {
      const el2 = inputRef.current
      if (el2) {
        el2.focus({ preventScroll: true })
        selectName(el2)
      }
    })
    const timer = setTimeout(() => {
      const el3 = inputRef.current
      if (el3) {
        el3.focus({ preventScroll: true })
        selectName(el3)
      }
    }, 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [selectName])

  const submitting = useRef(false)
  const cancelled = useRef(false)

  /** Performs the submit operation. */
  const submit = async () => {
    if (submitting.current || cancelled.current) return
    if (!touched.current || !name.trim()) {
      cancelled.current = true
      onFinish(false)
      return
    }
    submitting.current = true
    setBusy(true)
    setError("")
    try {
      const trimmed = name.trim()
      const filename = !resourceStyle && suffix && !trimmed.toLowerCase().endsWith(suffix.toLowerCase()) ? trimmed + suffix : trimmed
      const node = await window.electronAPI.createWorkspaceEntry(workspace.path, draft.parent, filename, draft.kind)
      if (draft.kind === "file" && filename.toLowerCase().endsWith(".markdowntable")) {
        await window.electronAPI.saveContent(node.path, createMarkdownTableDocument(filename))
      }
      if (draft.kind === "file" && filename.toLowerCase().endsWith(".excalidraw.md")) {
        await window.electronAPI.saveContent(node.path, createNewExcalidrawContent(filename))
      }
      if (draft.kind === "file" && filename.toLowerCase().endsWith(".mind")) {
        await window.electronAPI.saveContent(node.path, createMindmapDocument(filename))
      }
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
      className="flex w-full min-w-0 flex-1 items-center"
      style={resourceStyle ? rowStyle : { height: layout.rowHeight, paddingLeft: rowStyle.paddingLeft, paddingRight: rowStyle.paddingRight }}
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      {resourceStyle && <FileThemeIcon
        name={name}
        directory={draft.kind === "directory"}
        className="!size-[var(--tree-icon-size)] shrink-0 object-contain"
        fallback={draft.kind === "directory" ? <Folder className="!size-[var(--tree-icon-size)] shrink-0 text-amber-500" /> : <File className="!size-[var(--tree-icon-size)] shrink-0 text-stone-400" />}
      />}
      <div
        style={{ height: inputHeight }}
        className={`flex min-w-0 flex-1 items-center border ${resourceStyle ? "!rounded-none border-[#007acc] bg-white px-1 dark:border-[#007fd4] dark:bg-[#3c3c3c]" : "rounded-sm border-green-600 bg-transparent px-1.5"}`}
      >
        <input
          autoFocus
          placeholder="未命名"
          ref={focusInput}
          onFocus={(event) => selectName(event.target)}
          aria-label={draft.kind === "file" ? "新文件名称" : "新文件夹名称"}
          style={{ fontSize: resourceStyle ? layout.fontSize : 12, lineHeight: "normal" }}
          className="h-full min-w-0 flex-1 !rounded-none !border-0 !bg-transparent p-0 !shadow-none !outline-none !ring-0"
          onBlur={() => {
            if (!error) void submit()
          }}
          value={name}
          disabled={busy}
          onChange={(event) => {
            touched.current = true
            setName(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape" && !busy) {
              cancelled.current = true
              onFinish(false)
            }
          }}
          data-title={error || undefined}
          aria-invalid={!!error}
        />
        {suffix && !resourceStyle && <span className="shrink-0 select-none pl-1 text-xs text-muted-foreground" aria-label="文件后缀">{suffix}</span>}
      </div>
      <AlertDialog
        open={!!error}
        onOpenChange={(open) => {
          if (!open) setError("")
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>无法创建</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>知道了</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}
