import { AlertDialog as ModalAlertDialog, AlertDialogAction as ModalAlertDialogAction, AlertDialogCancel as ModalAlertDialogCancel, AlertDialogContent as ModalAlertDialogContent, AlertDialogDescription as ModalAlertDialogDescription, AlertDialogFooter as ModalAlertDialogFooter, AlertDialogHeader as ModalAlertDialogHeader, AlertDialogTitle as ModalAlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogPortal, DialogTitle } from "@/components/ui/dialog"
import "@/components/ui/confirm-dialog.css"
import { Pencil, Trash2 } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"

/** 与待办表格二次确认弹窗一致的确认框；danger 为删除类（红色），否则为普通确认（绿色）。 */
export function ConfirmDialog({
  activityBarAccessible = false,
  statusBarAccessible = false,
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  busy,
  error,
  tone = "danger",
  onConfirm
}: {
  activityBarAccessible?: boolean
  statusBarAccessible?: boolean
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
  const AlertDialog = activityBarAccessible ? ActivityDialog : ModalAlertDialog
  const AlertDialogContent = activityBarAccessible ? DialogContent : ModalAlertDialogContent
  const AlertDialogHeader = activityBarAccessible ? DialogHeader : ModalAlertDialogHeader
  const AlertDialogTitle = activityBarAccessible ? DialogTitle : ModalAlertDialogTitle
  const AlertDialogDescription = activityBarAccessible ? DialogDescription : ModalAlertDialogDescription
  const AlertDialogFooter = activityBarAccessible ? DialogFooter : ModalAlertDialogFooter
  const AlertDialogCancel = activityBarAccessible ? "button" : ModalAlertDialogCancel
  const AlertDialogAction = activityBarAccessible ? "button" : ModalAlertDialogAction
  const Icon = tone === "danger" ? Trash2 : Pencil
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      {activityBarAccessible && <DialogPortal>
        <div aria-hidden="true" data-confirm-overlay style={statusBarAccessible ? { bottom: 32 } : undefined} className="fixed inset-y-0 right-0 left-[52px] z-[230] bg-black/[.04] backdrop-blur-[3px]" />
      </DialogPortal>}
      <AlertDialogContent
        {...(activityBarAccessible ? { showCloseButton: false, style: { left: "calc(50% + 26px)", width: "calc(100vw - 84px)" } } : {})}
        className="todo-confirm-dialog"
        overlayClassName="!z-[230] !bg-black/[.04] backdrop-blur-[3px]"
      >
        <div className="todo-confirm-heading">
          <span
            className={tone === "danger" ? "todo-confirm-icon" : "todo-confirm-icon todo-confirm-icon-primary"}
            aria-hidden="true"
          >
            <Icon />
          </span>
          <AlertDialogHeader className="todo-confirm-text">
            <AlertDialogTitle className="todo-confirm-title">{title}</AlertDialogTitle>
            <AlertDialogDescription className="todo-confirm-description break-all">{description}</AlertDialogDescription>
            {error && (
              <p
                role="alert"
                className="break-all text-xs text-red-500"
              >
                {error}
              </p>
            )}
          </AlertDialogHeader>
        </div>
        <AlertDialogFooter className="todo-confirm-actions">
          <AlertDialogCancel
            type="button"
            onClick={() => { if (activityBarAccessible) onOpenChange(false) }}
            className="todo-confirm-cancel"
            disabled={busy}
          >
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className={tone === "danger" ? "todo-confirm-delete" : "todo-confirm-primary"}
            disabled={busy}
            onClick={(event) => {
              event.preventDefault()
              onConfirm()
            }}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function ActivityDialog(props: ComponentProps<typeof Dialog>) {
  return <Dialog {...props} modal={false} />
}
