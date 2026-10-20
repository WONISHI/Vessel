import type { BackupStatus as State } from "@vessel/type"
import { AlertCircle, CircleCheck, CloudUpload } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

/** Formats sync time. */
function formatSyncTime(timeStr: string): string {
  const date = new Date(timeStr)
  if (isNaN(date.getTime())) return timeStr
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  return `${year}年${month}月${day}日 ${hours}:${minutes}`
}

/** Renders the backup status component. */
export function BackupStatus({ workspace, file }: { workspace: string; file?: string | null }) {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<State>({ running: false })
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let active = true

    /** Refreshes the current state. */
    const update = () => {
      void Promise.all([window.electronAPI.getSettings(), window.electronAPI.getBackupStatus()])
        .then(([settings, value]) => {
          if (active) {
            setEnabled(settings.backup.enabled === true && settings.backup.workspacePath === workspace)
            setStatus(value)
          }
        })
        .catch(() => {})
    }

    /** Handles sync status events. */
    const onSyncStatus = (event: Event) => {
      const customEvent = event as CustomEvent<State>
      if (active && customEvent.detail) setStatus(customEvent.detail)
    }
    window.addEventListener("vessel:sync-context", update)
    window.addEventListener("vessel:settings-saved", update)
    window.addEventListener("vessel:sync-status", onSyncStatus)
    update()
    const timer = setInterval(update, 10000)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("vessel:sync-context", update)
      window.removeEventListener("vessel:settings-saved", update)
      window.removeEventListener("vessel:sync-status", onSyncStatus)
    }
  }, [workspace])

  if (!enabled) return null

  const elapsed = status.time ? now - new Date(status.time).getTime() : 0
  const syncLabel = elapsed < 60_000 ? "同步成功" : `上次同步 ${formatSyncTime(status.time!)}`

  const label = status.running
    ? status.progress?.phase === "remote"
      ? "读取远端"
      : status.progress?.phase === "hashing"
        ? "检查本地"
        : status.progress?.phase === "planning"
          ? "比较文件"
          : status.progress
            ? `同步 ${status.progress.completed}/${status.progress.total}`
            : "扫描文件"
    : status.error
      ? "同步失败"
      : status.conflicts?.length
        ? "已备份（有冲突副本）"
        : status.time
          ? syncLabel
          : "未同步"

  const Icon = status.error ? AlertCircle : status.time && !status.running ? CircleCheck : CloudUpload

  return (
    <button
      data-title={status.error || (status.time ? `上次同步：${new Date(status.time).toLocaleString()}；点击同步当前文件` : "点击同步当前文件")}
      disabled={status.running || !file}
      data-sync-state={status.running ? "running" : status.error ? "error" : status.time ? (elapsed < 60_000 ? "success" : "last") : "idle"}
      className={`flex h-6 items-center gap-1 rounded px-2 hover:bg-stone-200 ${status.running ? "text-blue-600" : status.error ? "text-red-600" : status.time ? "text-green-700" : "text-stone-500"}`}
      onClick={() => {
        setStatus((current) => ({ ...current, running: true }))
        void window.electronAPI
          .runBackup(file || "", workspace)
          .then(setStatus)
          .catch((error) => {
            setStatus((current) => ({ ...current, running: false, error: String(error) }))
            toast.error(String(error))
          })
      }}
    >
      <Icon className={`size-3.5 ${status.running ? "animate-pulse" : ""}`} />
      {label}
    </button>
  )
}
