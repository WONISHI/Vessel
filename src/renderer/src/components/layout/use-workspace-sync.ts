import { useEffect, useRef, useState } from "react"
import type { BackupStatus } from "@vessel/type"
import { toast } from "@/components/ui/sonner"

export function useWorkspaceSync(active: boolean) {
  const [state, setState] = useState({ enabled: false, running: false, workspace: "" })
  const pending = useRef(false)
  useEffect(() => {
    if (!active) return
    let alive = true, revision = 0
    const refresh = () => {
      if (!window.electronAPI?.getSettings || !window.electronAPI?.getBackupStatus) return
      const request = ++revision
      void Promise.all([window.electronAPI.getSettings(), window.electronAPI.getBackupStatus()]).then(([settings, status]) => {
        if (alive && request === revision) setState({ enabled: Boolean(settings.backup?.enabled && settings.backup.workspacePath), running: pending.current || status.running, workspace: settings.backup?.workspacePath || "" })
      }).catch(() => {})
    }
    const statusChanged = (event: Event) => {
      const status = (event as CustomEvent<BackupStatus>).detail
      if (status) {
        revision++
        setState(value => ({ ...value, running: pending.current || status.running }))
      } else refresh()
    }
    refresh()
    const timer = setInterval(refresh, 10000)
    window.addEventListener("vessel:sync-status", statusChanged)
    window.addEventListener("vessel:sync-context", refresh)
    window.addEventListener("vessel:settings-saved", refresh)
    window.addEventListener("vessel:request-page-sync-state", refresh)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener("vessel:sync-status", statusChanged)
      window.removeEventListener("vessel:sync-context", refresh)
      window.removeEventListener("vessel:settings-saved", refresh)
      window.removeEventListener("vessel:request-page-sync-state", refresh)
    }
  }, [active])
  const sync = async () => {
    if (!active || !state.enabled || state.running || pending.current) return
    pending.current = true
    setState(value => ({ ...value, running: true }))
    window.dispatchEvent(new CustomEvent("vessel:sync-status", { detail: { running: true } }))
    try {
      const result = await window.electronAPI.runBackup(undefined, state.workspace)
      if (result.error) toast.error(result.error)
      else toast.success("工作区同步完成")
    } catch (error) { toast.error(String(error)) }
    finally {
      pending.current = false
      setState(value => ({ ...value, running: false }))
      window.dispatchEvent(new Event("vessel:sync-status"))
    }
  }
  return { ...state, sync }
}
