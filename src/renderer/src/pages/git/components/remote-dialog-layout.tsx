import type { ReactNode } from "react"
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/** Match the compact create-branch dialog's heading, dividers and footer. */
export function RemoteDialogHeader({ icon, title, description, hidden }: { icon: ReactNode; title: string; description: string; hidden?: boolean }) {
  return <div className={hidden ? "sr-only" : "flex items-center gap-3 border-b border-stone-200/80 px-5 py-3.5 dark:border-stone-700/70"}>
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">{icon}</span>
    <DialogHeader className="min-w-0 space-y-0.5 text-left">
      <DialogTitle className="text-[15px] font-semibold">{title}</DialogTitle>
      <DialogDescription className="text-xs leading-relaxed">{description}</DialogDescription>
    </DialogHeader>
  </div>
}

export function RemoteDialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex shrink-0 justify-end gap-2 border-t border-stone-200/80 px-5 py-3 dark:border-stone-700/70">{children}</div>
}
