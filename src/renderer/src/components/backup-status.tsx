import { useEffect, useState } from "react"
import { CloudUpload, CircleCheck, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type { BackupStatus as State } from "../../../shared/settings"
export function BackupStatus() {
  const [status, setStatus] = useState<State>({ running: false })
  useEffect(() => {
    let active = true
    const update = () => { void window.electronAPI.getBackupStatus().then(value => { if (active) setStatus(value) }).catch(() => {}) }
    update(); const timer = setInterval(update, 15000)
    return () => { active = false; clearInterval(timer) }
  }, [])
  const label = status.running ? "同步中" : status.error ? "同步失败" : status.time ? "已同步" : "未同步"
  const Icon = status.error ? AlertCircle : status.time && !status.running ? CircleCheck : CloudUpload
  return <button title={status.error || (status.time ? `上次同步：${new Date(status.time).toLocaleString()}；点击立即同步` : "点击立即同步")} disabled={status.running} className={`flex h-6 items-center gap-1 rounded px-2 hover:bg-stone-200 ${status.running ? "text-blue-600" : status.error ? "text-red-600" : status.time ? "text-green-700" : "text-stone-500"}`} onClick={() => { setStatus(current => ({ ...current, running: true })); void window.electronAPI.runBackup().then(setStatus).catch(error => { setStatus(current => ({ ...current, running: false, error: String(error) })); toast.error(String(error)) }) }}><Icon className={`size-3.5 ${status.running ? "animate-pulse" : ""}`} />{label}</button>
}
