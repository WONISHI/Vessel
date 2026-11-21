import { useState } from "react"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { LibraryProject } from "./library-state"

/** Guard project selection before changing its route, tabs or current-project record. */
export function useProjectSwitchConfirmation() {
  const [pending, setPending] = useState<{ current: LibraryProject; target: LibraryProject; proceed: () => void } | null>(null)
  const requestSwitch = (target: LibraryProject, proceed: () => void) => {
    let current: LibraryProject | null = null
    try { current = JSON.parse(localStorage.getItem("resource_current_project") || "null") } catch { /* No previous selection. */ }
    if (!current?.path || current.path === target.path) { proceed(); return }
    setPending({ current, target, proceed })
  }
  const confirmation = <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null) }} tone="primary"
    title="切换项目？"
    description={pending ? `即将从「${pending.current.name || pending.current.path}」切换到「${pending.target.name}」。切换可能中断当前终端中正在运行的命令或请求，建议等待任务完成后再继续。` : ""}
    confirmText="切换项目" onConfirm={() => { const proceed = pending?.proceed; setPending(null); proceed?.() }} />
  return { requestSwitch, confirmation }
}
