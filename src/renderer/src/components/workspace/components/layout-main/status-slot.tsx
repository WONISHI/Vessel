import { StatusTarget } from "@/components/workspace/components/layout-main/status-context"
import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"

/** Renders the status slot component. */
export function StatusSlot({ children }: { children: ReactNode }) {
  const target = useContext(StatusTarget)
  return target ? createPortal(children, target) : <>{children}</>
}
