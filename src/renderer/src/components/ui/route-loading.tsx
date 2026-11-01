import type { AsideActivity } from "@/components/layout/activity-bar/activity"
import ActivityBar from "@/components/layout/activity-bar/index"
import Layout from "@/components/layout/index"
import { EditorLoading } from "@/components/ui/editor-loading"
import type { ReactNode } from "react"
import { useNavigate } from "react-router-dom"

export type RouteLoadingOptions = {
  icon?: ReactNode
  title?: string
  label?: string
  /** Set for routes whose page shows the activity bar; the bar stays visible and only the content area is masked. */
  activity?: AsideActivity
}

/** Full-size ONLYOFFICE-style mask; fills its parent, also inside flex rows. */
function LoadingMask({ icon, title = "正在加载页面", label = "正在准备页面内容，请稍候…" }: RouteLoadingOptions) {
  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 self-stretch">
      <div className="absolute inset-0 flex">
        <EditorLoading kind="office" icon={icon} title={title} label={label} />
      </div>
    </div>
  )
}

/** Same layout as the loaded page (Layout + ActivityBar), so the bar does not disappear while the chunk loads. */
function LoadingWithActivityBar({ activity, ...mask }: RouteLoadingOptions & { activity: AsideActivity }) {
  const navigate = useNavigate()
  const change = (act: AsideActivity) => {
    if (act === activity) return
    if (act === "tools") navigate("/devtools")
    else if (act === "files") navigate("/editor")
    else if (act === "postman") navigate("/api-client")
    else navigate(`/${act}`)
  }
  return (
    <Layout aside={<ActivityBar activity={activity} onActivityChange={change} />}>
      <LoadingMask {...mask} />
    </Layout>
  )
}

/**
 * The single loading overlay for lazy routes and keep-alive pages. When `activity` is given the activity bar is
 * rendered beside the mask; Suspense replaces this whole fallback with the page (which renders its own bar), so
 * the bar is never rendered twice.
 */
export function RouteLoading({ activity, ...mask }: RouteLoadingOptions) {
  return activity ? <LoadingWithActivityBar activity={activity} {...mask} /> : <LoadingMask {...mask} />
}
