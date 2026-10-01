import { useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { StatusTarget } from "./status-context"
export function StatusSlot({ children }: { children: ReactNode }) {
  const target = useContext(StatusTarget)
  return target ? createPortal(children, target) : <>{children}</>
}
