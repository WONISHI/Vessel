import { useEffect, useRef } from "react"

/** Loads the next history page shortly before the ScrollArea reaches its end. */
export function HistoryLoadMore({ loaded, total, loading, failed, paused, onLoad }: { loaded: number; total: number; loading: boolean; failed: boolean; paused: boolean; onLoad: () => void }) {
  const target = useRef<HTMLDivElement>(null)
  const hasMore = loaded < total
  useEffect(() => {
    const element = target.current
    if (!element || !hasMore || loading || failed || paused) return
    const root = element.closest('[data-radix-scroll-area-viewport]')
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoad()
    }, { root, rootMargin: "0px 0px 320px 0px" })
    observer.observe(element)
    return () => observer.disconnect()
  }, [hasMore, loading, failed, paused, onLoad])
  return (
    <div ref={target} className="flex items-center justify-center gap-3 border-t border-stone-200 px-3 py-2 text-xs text-stone-400">
      <span role="status">已加载 {loaded} / {total} 条{loading ? " · 加载中…" : !hasMore ? " · 已全部加载" : ""}</span>
      {hasMore && <button type="button" disabled={loading || paused} onClick={onLoad} className="rounded px-3 py-1 text-green-600 hover:bg-stone-100 disabled:opacity-50">{failed ? "加载失败，点击重试" : "加载更早记录"}</button>}
    </div>
  )
}
