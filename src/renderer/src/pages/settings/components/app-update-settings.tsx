import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { AppUpdateState } from "../../../../../shared/app-update"

export function AppUpdateSettings() {
  const [state, setState] = useState<AppUpdateState>()
  const [confirmInstall, setConfirmInstall] = useState(false)

  useEffect(() => {
    let active = true
    const unsubscribe = window.electronAPI.onAppUpdate(setState)
    void window.electronAPI.getAppUpdate().then((next) => { if (active) setState(next) }).catch(console.error)
    return () => { active = false; unsubscribe() }
  }, [])

  if (!state || state.status === "unsupported") return null

  const description = {
    idle: "通过 GitHub Releases 检查新版本。",
    checking: "正在检查更新…",
    current: "已是最新版本。",
    available: "version" in state ? `发现新版本 ${state.version}` : "",
    downloading: state.status === "downloading" ? `正在下载更新 · ${Math.round(state.percent)}%` : "",
    ready: "更新已下载，可以重启安装。",
    installing: "正在准备重启…",
    error: state.status === "error" ? state.message : ""
  }[state.status]
  const busy = state.status === "checking" || state.status === "downloading" || state.status === "installing"
  const run = (action: () => Promise<void>) => void action().catch(() => toast.error("无法执行更新操作，请重试。"))

  return (
    <div className="settings-card flex items-center justify-between gap-4 p-4">
      <div>
        <h3 className="text-sm font-semibold">应用更新</h3>
        <p role="status" className="text-xs text-muted-foreground">{description}</p>
        {state.status === "downloading" && <progress className="mt-2 w-full" max={100} value={state.percent} aria-label="更新下载进度" />}
      </div>
      {state.status === "available" ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => run(() => window.electronAPI.openExternal("https://github.com/WONISHI/Vessel/releases"))}>
            更新说明
          </Button>
          <Button onClick={() => run(window.electronAPI.downloadAppUpdate)}>下载更新</Button>
        </div>
      ) : state.status === "ready" ? (
        <Button onClick={() => setConfirmInstall(true)}>重启并安装</Button>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => run(window.electronAPI.checkAppUpdate)}>检查更新</Button>
      )}
      <ConfirmDialog
        open={confirmInstall}
        onOpenChange={setConfirmInstall}
        title="重启并安装更新"
        description="Vessel 将关闭并安装更新，请先保存正在编辑的内容。"
        confirmText="重启并安装"
        tone="primary"
        onConfirm={() => {
          setConfirmInstall(false)
          run(window.electronAPI.installAppUpdate)
        }}
      />
    </div>
  )
}
