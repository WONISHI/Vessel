import { RouteLoading } from "@/components/ui/route-loading"
import { FileText } from "lucide-react"
import { lazyWithRetry } from "@/lib/lazy-retry"
import { Suspense, useState } from "react"
import { useLocation } from "react-router-dom"

// ONLYOFFICE 页面首次访问时才加载
const OfficePage = lazyWithRetry(() => import("@/pages/office/components/office-page").then((module) => ({ default: module.OfficePage })))

/** Renders the office keep alive component. */
export function OfficeKeepAlive() {
  const visible = useLocation().pathname === "/office"
  const [visited, setVisited] = useState(visible)
  if (visible && !visited) setVisited(true)
  return visited ? (
    <div
      hidden={!visible}
      className="h-full w-full"
    >
      <Suspense fallback={<RouteLoading activity="office" icon={<FileText />} title="正在加载文档" label="正在准备 ONLYOFFICE 编辑器，请稍候…" />}>
        <OfficePage visible={visible} />
      </Suspense>
    </div>
  ) : null
}
