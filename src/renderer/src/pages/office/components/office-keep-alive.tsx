import { OfficePage } from "@/pages/office/components/office-page"
import { useState } from "react"
import { useLocation } from "react-router-dom"

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
      <OfficePage />
    </div>
  ) : null
}
