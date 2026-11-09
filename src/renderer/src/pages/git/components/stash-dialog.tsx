import "./create-tag-dialog.css"
import { useState } from "react"
import { Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CheckField } from "./git-check-field"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import type { StashRequest } from "@/pages/git/hooks/use-git-file-actions"

/** Replaces window.prompt (unsupported in Electron) for stashing selected files or the whole working tree. */
export function StashDialog({ request, onClose, onSubmit }: { request: StashRequest; onClose: () => void; onSubmit: (message: string, keepIndex: boolean) => Promise<void> }) {
  const [message, setMessage] = useState(request.defaultMessage)
  const [keepIndex, setKeepIndex] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const paths = request.paths
  const submit = async () => {
    if (busy) return
    setBusy(true)
    setError("")
    try { await onSubmit(message, keepIndex) }
    catch (reason) { setError(cleanGitErrorMessage(reason)) }
    finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent showCloseButton={false} className="git-dialog git-tag-dialog flex max-h-[90vh] max-w-[460px] flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b border-stone-200/80 px-5 py-3.5 dark:border-stone-700/70">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"><Archive className="size-4" /></span>
          <DialogHeader className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-[15px] font-semibold">贮藏修改</DialogTitle>
            <DialogDescription className="truncate text-xs">{paths ? `贮藏选中的 ${paths.length} 个文件（含未跟踪文件）` : "贮藏工作区的全部修改（含未跟踪文件）"}</DialogDescription>
          </DialogHeader>
        </div>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-xs">
            <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3">
              <label htmlFor="stash-message" className="text-right text-stone-500 dark:text-stone-400">说明</label>
              <Input id="stash-message" autoFocus value={message} disabled={busy} placeholder={request.defaultMessage} onChange={(event) => setMessage(event.target.value)} onFocus={(event) => event.currentTarget.select()} className="h-8 text-xs md:text-xs" />
              <span className="text-right text-stone-500 dark:text-stone-400">选项</span>
              <CheckField id="stash-keep-index" checked={keepIndex} disabled={busy} onChange={setKeepIndex}>保留已暂存的修改<span className="ml-1 text-stone-400">（--keep-index）</span></CheckField>
            </div>
            {paths && paths.length > 1 && <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-lg border border-stone-200/80 bg-stone-50/60 p-2 font-mono text-[11px] text-stone-500 dark:border-stone-700/70 dark:bg-white/[.03] dark:text-stone-400">
              {paths.map((path) => <li key={path} className="truncate" title={path}>{path}</li>)}
            </ul>}
            {error && <p role="alert" className="rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200/80 px-5 py-3 dark:border-stone-700/70">
            <Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" disabled={busy} onClick={onClose}>取消</Button>
            <Button type="submit" size="sm" className="git-tag-submit h-8 min-w-16 text-xs" disabled={busy}>{busy ? "正在贮藏…" : "贮藏"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
