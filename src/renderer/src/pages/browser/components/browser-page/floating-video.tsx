import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { withGuest } from "@/pages/browser/guest-lifecycle"
import type { WebviewTag } from "electron"
import { FilePlay, Film } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { setFloatingGuest } from "./floating-video-overlay"
import { floatingVideoGuest } from "./floating-video-guest"

type Video = { id: number; duration: number | null; live: boolean; width: number; height: number; floating: boolean }

function durationLabel(video: Video) {
  if (video.live) return "直播"
  if (video.duration === null) return "时长未知"
  const seconds = Math.floor(video.duration)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

export function FloatingVideo({ visible, tabId, url, getGuest }: {
  visible: boolean
  tabId: string
  url: string
  getGuest: () => WebviewTag | undefined
}) {
  const guestRef = useRef(getGuest)
  guestRef.current = getGuest
  const [enabled, setEnabled] = useState(false)
  const [videos, setVideos] = useState<Video[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    const refresh = () => {
      void window.electronAPI.getSettings().then((settings) => {
        if (active) setEnabled(settings.floatingVideoEnabled === true)
      }).catch(() => {})
    }
    refresh()
    window.addEventListener("vessel:settings-saved", refresh)
    return () => {
      active = false
      window.removeEventListener("vessel:settings-saved", refresh)
    }
  }, [])

  useEffect(() => {
    setVideos([])
    setOpen(false)
    if (!enabled || !visible || !url) return
    let active = true
    let timer: ReturnType<typeof setTimeout>

    const scan = async () => {
      const guest = guestRef.current()
      try {
        const result = await withGuest(guest, (view) => view.executeJavaScript(`(${floatingVideoGuest.toString()})("list")`))
        if (active) setVideos(Array.isArray(result) ? result : [])
      } catch {
        if (active) setVideos([])
      } finally {
        if (active) timer = setTimeout(scan, 2000)
      }
    }
    void scan()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [enabled, visible, tabId, url])

  useEffect(() => {
    if (!enabled) setFloatingGuest(undefined)
  }, [enabled])

  if (!enabled || !visible) return null

  const play = (id: number) => {
    const guest = guestRef.current()
    const request = withGuest(guest, (view) => view.executeJavaScript(`(${floatingVideoGuest.toString()})("open", ${JSON.stringify(id)})`, true))
    if (!request || !guest) {
      toast.error("网页尚未就绪，请稍后重试")
      return
    }
    void request.then(() => {
      setFloatingGuest(guest)
      setOpen(false)
    }).catch(() => toast.error("无法打开悬浮视频"))
  }

  return (
    <Popover open={open && videos.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`悬浮视频，检测到 ${videos.length} 个`} disabled={!url || videos.length === 0}>
          <Film />
          {!!videos.length && <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 rounded bg-green-700 px-1 text-[9px] leading-3 text-white">{videos.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p className="mb-2 text-sm font-medium">检测到 {videos.length} 个视频</p>
        {videos.length ? (
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {videos.map((video, order) => (
              <Button key={video.id} variant="ghost" className="w-full justify-between hover:bg-muted" disabled={video.floating} onClick={() => play(video.id)}>
                <span className="flex items-center gap-2"><FilePlay className="size-4 shrink-0" aria-hidden="true" />视频 {order + 1}</span>
                <span className="text-xs text-muted-foreground">{video.floating ? "悬浮中" : durationLabel(video)}{video.width > 0 && ` · ${video.width}×${video.height}`}</span>
              </Button>
            ))}
          </div>
        ) : <p className="text-xs text-muted-foreground">当前网页暂无可用视频。可以先在网页上开始播放。</p>}
      </PopoverContent>
    </Popover>
  )
}
