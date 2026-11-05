import { RouteLoading } from "@/components/ui/route-loading"
import { Globe } from "lucide-react"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, useState } from "react"
import { useLocation } from "react-router-dom"

// 浏览器页（含 webview 管理）首次访问时才加载
const loadBrowserPage = async () => {
  const [page] = await Promise.all([
    import("@/pages/browser/index"),
    window.electronAPI.listBrowserExtensions?.().catch((error) => console.error("加载浏览器扩展失败", error))
  ])
  return page
}
const BrowserPage = lazyWithRetry(loadBrowserPage)

/** 活动栏切换只隐藏浏览器，保留 guest、历史记录与表单状态。 */
export function BrowserKeepAlive() {
  const visible = useLocation().pathname === "/browser"
  const [visited, setVisited] = useState(visible)
  if (visible && !visited) setVisited(true)
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
