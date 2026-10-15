import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { BackupLogs } from "@vessel/type"
export function SyncDiagnosticsPanel({ workspace, running }: { workspace?: string; running: boolean }) {
  const [visible, setVisible] = useState(false)
  const [logs, setLogs] = useState<BackupLogs>({ enabled: false, entries: [] })
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const refresh = async () => {
    setLoading(true); setError("")
    try { setLogs(await window.electronAPI.getBackupLogs()) }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
    finally { setLoading(false) }
  }
  useEffect(() => {
    if (!visible) return
    let active = true
    const update = () => { void window.electronAPI.getBackupLogs().then(value => { if (active) setLogs(value) }).catch(error => { if (active) setError(String(error)) }) }
    const timer = setInterval(update, 3000)
    return () => { active = false; clearInterval(timer) }
  }, [visible, workspace])
  return <div className="mt-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-center gap-2"><h3 className="mr-auto">日志检查</h3><Button variant="outline" disabled={!workspace || loading} onClick={() => { setVisible(true); void refresh() }}>{visible ? "刷新日志" : "查看日志"}</Button>{visible && <Button variant="outline" disabled={running || loading || !logs.entries.length} onClick={() => { setLoading(true); void window.electronAPI.clearBackupLogs().then(refresh).catch(error => setError(String(error))).finally(() => setLoading(false)) }}>清空日志</Button>}</div>
    {visible && <><p className="mt-2 text-xs text-muted-foreground">{logs.enabled ? "诊断日志已开启，每 3 秒刷新，显示最近 200 条记录。" : "诊断日志已关闭。开启开关并保存设置后开始记录。"}</p>{(error || logs.warning) && <p role="alert" className="mt-2 text-xs text-red-600">{error || logs.warning}</p>}<div role="log" aria-label="同步诊断日志" className="mt-3 max-h-72 overflow-auto rounded-lg bg-muted/30 p-3 font-mono text-xs">{logs.entries.length ? logs.entries.map(entry => <div key={entry.id} className={`mb-2 break-all ${entry.type === "error" ? "text-red-600" : "text-muted-foreground"}`}><span>{new Date(entry.time).toLocaleString()}</span>{" · "}<span>{entry.message}</span>{entry.path && <div className="mt-1 pl-3">{entry.path}</div>}{entry.code && <div className="pl-3">错误代码：{entry.code}</div>}</div>) : <p>{loading ? "正在读取日志…" : "暂无诊断记录"}</p>}</div></>}
  </div>
}
