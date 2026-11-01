import { RouteLoading } from "@/components/ui/route-loading"
import { Globe } from "lucide-react"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

// 浏览器页（含 webview 管理）首次访问时才加载
const loadBrowserPage = () => import("@/pages/browser/index")
const BrowserPage = lazyWithRetry(loadBrowserPage)

/** 活动栏切换只隐藏浏览器，保留 guest、历史记录与表单状态。 */
export function BrowserKeepAlive() {
  const visible = useLocation().pathname === "/browser"
  const [visited, setVisited] = useState(visible)
  if (visible && !visited) setVisited(true)
  // Warm the browser chunk while the app is idle so the first activity-bar click skips the download/parse wait.
  useEffect(() => {
    if (visited) return
    const warm = () => void loadBrowserPage().catch(() => {})
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 5000 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = setTimeout(warm, 2000)
    return () => clearTimeout(timer)
  }, [visited])
  if (!visited && !visible) return null
  return (
    <div
      hidden={!visible}
      data-vessel-browser-page
      className="h-full w-full min-w-0 min-h-0"
    >
      <Suspense fallback={<RouteLoading activity="browser" icon={<Globe />} title="正在加载浏览器" label="正在准备网页浏览环境，请稍候…" />}>
        <BrowserPage visible={visible} />
      </Suspense>
    </div>
  )
}
