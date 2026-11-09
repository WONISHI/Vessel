import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

/** Shared shell for API page dialogs: icon header, scrollable body, footer actions. */
export function ApiDialog({ open = true, onClose, icon: Icon, title, description, children, footer, className, onSubmit }: { open?: boolean; onClose: () => void; icon: LucideIcon; title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; onSubmit?: () => void }) {
  const body = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-xs">{children}</div>
      {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t px-5 py-3">{footer}</div>}
    </>
  )
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent showCloseButton={false} className={cn("api-dialog flex max-h-[86vh] max-w-[480px] flex-col gap-0 overflow-hidden p-0", className)}>
        <div className="flex items-center gap-3 border-b px-5 py-3.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"><Icon className="size-4" /></span>
          <DialogHeader className="min-w-0 space-y-0.5 text-left">
            <DialogTitle className="text-[15px] font-semibold">{title}</DialogTitle>
            <DialogDescription className={cn("truncate text-xs", !description && "sr-only")}>{description ?? title}</DialogDescription>
          </DialogHeader>
        </div>
        {onSubmit ? <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); onSubmit() }}>{body}</form> : body}
      </DialogContent>
    </Dialog>
  )
}

export const primaryButton = "h-8 min-w-16 bg-amber-500 text-xs text-white hover:bg-amber-600 disabled:opacity-50"
export const secondaryButton = "h-8 text-xs hover:!bg-stone-100 hover:!text-stone-800 dark:hover:!bg-white/10 dark:hover:!text-stone-100"

/** Single-field dialog replacing window.prompt (unsupported in Electron). */
export function NameDialog({ title, label, initial = "", placeholder, icon, confirmText = "确定", onClose, onSubmit }: { title: string; label: string; initial?: string; placeholder?: string; icon: LucideIcon; confirmText?: string; onClose: () => void; onSubmit: (value: string) => Promise<void> | void }) {
  const [value, setValue] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const submit = async () => {
    if (!value.trim() || busy) return
    setBusy(true)
    setError("")
    try {
      await onSubmit(value.trim())
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason))
    } finally {
      setBusy(false)
    }
  }
  return (
    <ApiDialog onClose={onClose} icon={icon} title={title} onSubmit={() => void submit()} footer={<>
      <Button type="button" variant="outline" size="sm" className={secondaryButton} onClick={onClose} disabled={busy}>取消</Button>
      <Button type="submit" size="sm" className={primaryButton} disabled={busy || !value.trim()}>{confirmText}</Button>
    </>}>
      <label className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3">
        <span className="text-right text-muted-foreground">{label}</span>
        <Input autoFocus value={value} placeholder={placeholder} onChange={(event) => setValue(event.target.value)} onFocus={(event) => event.currentTarget.select()} className="h-8 text-xs md:text-xs" />
      </label>
      {error && <p role="alert" className="mt-3 rounded-md bg-red-50 px-2.5 py-2 text-[11px] text-red-600 dark:bg-red-950/30 dark:text-red-400">{error}</p>}
    </ApiDialog>
  )
}
