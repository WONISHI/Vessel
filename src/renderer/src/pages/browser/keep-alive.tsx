import { useState } from "react"
import { useLocation } from "react-router-dom"
import BrowserPage from "./index"

/** 活动栏切换只隐藏浏览器，保留 guest、历史记录与表单状态。 */
export function BrowserKeepAlive() {
  const visible = useLocation().pathname === "/browser"
  const [visited, setVisited] = useState(visible)
  if (visible && !visited) setVisited(true)
  if (!visited && !visible) return null
  return <div hidden={!visible} className="h-full w-full min-w-0 min-h-0"><BrowserPage visible={visible} /></div>
}

export function BrowserRoute() { return null }
