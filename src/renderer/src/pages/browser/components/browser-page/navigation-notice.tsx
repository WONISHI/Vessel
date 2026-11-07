import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function NavigationNotice() {
  const [request, setRequest] = useState<{ id: number; url: string; defaultCurrent: boolean; delayMs: number }>()
  useEffect(() => {
    const stop = window.electronAPI.onNavigationRequest(setRequest)
    const dismiss = window.electronAPI.onNavigationDismiss((id) => setRequest((current) => current?.id === id ? undefined : current))
    return () => { stop(); dismiss() }
  }, [])
  if (!request) return null
  const answer = (current: boolean) => {
    setRequest(undefined)
    void window.electronAPI.answerNavigation(request.id, current).catch(console.error)
  }
  return (
    <div role="dialog" aria-label="选择页面打开方式" className="absolute right-3 top-3 z-[350] w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl dark:shadow-[0_12px_32px_rgba(0,0,0,.5)]">
      <h2 className="text-sm font-semibold">在哪里打开此页面？</h2>
      <p className="mt-1.5 line-clamp-2 break-all text-xs text-muted-foreground" title={request.url}>{request.url}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{request.delayMs} 毫秒未选择，将在{request.defaultCurrent ? "当前页面" : "新标签页"}打开。</p>
      <div className="mt-2.5 flex justify-end gap-2 [&_button]:h-7 [&_button]:px-2.5 [&_button]:text-xs [&_button:hover]:!text-white">
        <Button size="sm" className="bg-green-600 text-white hover:!bg-green-700 hover:!text-white" onClick={() => answer(false)}>新标签页打开</Button>
        <Button size="sm" variant="outline" onClick={() => answer(true)}>当前页面打开</Button>
      </div>
    </div>
  )
}
