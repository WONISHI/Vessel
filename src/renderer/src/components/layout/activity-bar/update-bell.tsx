import Logo from "@/assets/logo.png"
import DarkLogo from "@/assets/logo-dark.svg"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

type UpdateState = Awaited<ReturnType<Window["electronAPI"]["getAppUpdate"]>>

export function UpdateBell({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<UpdateState>()
  const [version, setVersion] = useState<string>()

  useEffect(() => {
    let active = true
    const unsubscribe = window.electronAPI.onAppUpdate(setState)
    void window.electronAPI.getAppUpdate().then((next) => { if (active) setState(next) }).catch(console.error)
    return () => { active = false; unsubscribe() }
  }, [])

  const nextVersion = state && "version" in state ? state.version : undefined
  const run = (action: () => Promise<void>) => void action().catch(() => toast.error("无法执行更新操作，请重试。"))

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next)
      if (next && !version) void window.electronAPI.getSettingsInfo().then((info) => setVersion(info.version)).catch(console.error)
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-activity-button
          aria-label={nextVersion ? "应用更新，1 条通知" : "应用更新"}
          className="relative size-[38px] rounded-[10px] text-[#a8a29e] hover:!bg-[#f0efed] hover:!text-[#a8a29e]"
        >
          <Bell className="!size-5" />
          {state?.status === "unsupported" && (
            <Button size="sm" variant="outline" onClick={() => run(() => window.electronAPI.openExternal("https://github.com/WONISHI/Vessel/releases"))}>下载新版</Button>
          )}
          {nextVersion && <span aria-hidden="true" className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-emerald-700 text-[10px] text-white">1</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={10} aria-label="应用更新">
        <div className="space-y-2 text-center">
          <img src={dark ? DarkLogo : Logo} alt="" className="mx-auto size-10 object-contain" />
          <h2 className="text-sm font-semibold">Vessel</h2>
          <p className="text-xs text-muted-foreground">当前版本 {version ?? "…"}</p>
          {state?.status === "unsupported" && (
            <Button size="sm" variant="outline" onClick={() => run(() => window.electronAPI.openExternal("https://github.com/WONISHI/Vessel/releases"))}>下载新版</Button>
          )}
          {nextVersion && <p className="text-sm">新版本 {nextVersion}</p>}
          <div role="status" className="text-xs text-muted-foreground">
            {state?.status === "unsupported" && "自动安装更新适用于 Windows 安装版。Mac 请下载新版安装包。"}
            {state?.status === "checking" && "正在检查更新…"}
            {state?.status === "current" && "已是最新版本。"}
            {state?.status === "error" && state.message}
            {state?.status === "ready" && "更新已下载，请保存正在编辑的内容后重启。"}
            {state?.status === "installing" && "正在准备重启…"}
            {state?.status === "downloading" && (
              <>
                <p>正在下载 · {Math.round(state.percent)}%</p>
                <progress className="mt-1 w-full" max={100} value={state.percent} aria-label="更新下载进度" />
              </>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-2">
          {state?.status === "unsupported" && (
            <Button size="sm" variant="outline" onClick={() => run(() => window.electronAPI.openExternal("https://github.com/WONISHI/Vessel/releases"))}>下载新版</Button>
          )}
          {nextVersion && <Button size="sm" variant="outline" onClick={() => setOpen(false)}>稍候更新</Button>}
          {state?.status === "available" && <Button size="sm" onClick={() => run(window.electronAPI.downloadAppUpdate)}>立刻更新</Button>}
          {state?.status === "ready" && <Button size="sm" onClick={() => run(window.electronAPI.installAppUpdate)}>重启并安装</Button>}
          {state && ["idle", "current", "error"].includes(state.status) && (
            <Button size="sm" variant="outline" onClick={() => run(window.electronAPI.checkAppUpdate)}>检查更新</Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
