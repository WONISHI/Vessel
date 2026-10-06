import type { ReactNode } from "react"
import { Pencil, Trash2 } from "lucide-react"
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog"
import "./confirm-dialog.css"

/** 与待办表格二次确认弹窗一致的确认框；danger 为删除类（红色），否则为普通确认（绿色）。 */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmText, busy, error, tone = "danger", onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmText: string
  busy?: boolean
  error?: string
  tone?: "danger" | "primary"
  onConfirm: () => void
}) {
  const Icon = tone === "danger" ? Trash2 : Pencil
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <AlertDialogContent className="todo-confirm-dialog" overlayClassName="!z-[230] !bg-black/45">
        <div className="todo-confirm-heading">
          <span className={tone === "danger" ? "todo-confirm-icon" : "todo-confirm-icon todo-confirm-icon-primary"} aria-hidden="true"><Icon /></span>
          <AlertDialogHeader className="todo-confirm-text">
            <AlertDialogTitle className="todo-confirm-title">{title}</AlertDialogTitle>
            <AlertDialogDescription className="todo-confirm-description break-all">{description}</AlertDialogDescription>
            {error && <p role="alert" className="break-all text-xs text-red-500">{error}</p>}
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="todo-confirm-actions">
          <AlertDialogCancel className="todo-confirm-cancel" disabled={busy}>取消</AlertDialogCancel>
          <AlertDialogAction className={tone === "danger" ? "todo-confirm-delete" : "todo-confirm-primary"} disabled={busy} onClick={(event) => { event.preventDefault(); onConfirm() }}>
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
