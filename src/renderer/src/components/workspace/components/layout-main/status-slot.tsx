import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import { useStatusBarVisible } from "@/features/status-bar/visibility"
import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Renders the status slot component. */
export function StatusSlot({ children }: { children: ReactNode }) {
  const target = useContext(StatusTarget)
  const visible = useStatusBarVisible()
  if (!visible) return null
  return target ? createPortal(children, target) : <>{children}</>
}
