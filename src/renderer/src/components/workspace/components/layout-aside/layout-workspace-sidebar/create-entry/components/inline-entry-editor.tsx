import { createMindmapDocument } from "@/components/core/canvas/variants/mindmap/document"
import { createNewExcalidrawContent } from "@/components/core/canvas/variants/excalidraw/parser"
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { EntryDraft } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/create-entry/components/create-entry-shared"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import { useCallback, useEffect, useRef, useState } from "react"

/** Renders the inline entry editor component. */
export function InlineEntryEditor({ draft, onFinish }: { draft: EntryDraft; onFinish: (created: boolean) => void }) {
  const { workspace, openWorkspaceFile } = useWorkspace()
  const [name, setName] = useState(draft.kind === "file" && draft.extension ? `未命名.${draft.extension}` : "")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const touched = useRef(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /** Focuses input. */
  const focusInput = useCallback((input: HTMLInputElement | null) => {
    inputRef.current = input
    if (input) {
      input.focus({ preventScroll: true })
      input.select()
    }
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (el) {
      el.focus({ preventScroll: true })
      el.select()
    }
    const raf = requestAnimationFrame(() => {
      const el2 = inputRef.current
      if (el2) {
        el2.focus({ preventScroll: true })
        el2.select()
      }
    })
    const timer = setTimeout(() => {
      const el3 = inputRef.current
      if (el3) {
        el3.focus({ preventScroll: true })
        el3.select()
      }
    }, 50)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [])

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
      const node = await window.electronAPI.createWorkspaceEntry(workspace.path, draft.parent, name.trim(), draft.kind)
      if (draft.kind === "file" && name.toLowerCase().endsWith(".excalidraw.md")) {
        await window.electronAPI.saveContent(node.path, createNewExcalidrawContent(name))
      }
      if (draft.kind === "file" && name.toLowerCase().endsWith(".mind")) {
        await window.electronAPI.saveContent(node.path, createMindmapDocument(name))
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
      className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-1 pr-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="flex min-w-0 flex-1 items-center rounded-sm border border-green-600 bg-transparent px-1.5 ">
        <input
          autoFocus
          placeholder="未命名"
          ref={focusInput}
          onFocus={(event) => event.target.select()}
          aria-label={draft.kind === "file" ? "新文件名称" : "新文件夹名称"}
          className="h-6 min-w-0 flex-1 !rounded-none !border-0 !bg-transparent p-0 text-xs !shadow-none !outline-none !ring-0"
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
