import type { RouterViewProps } from "#vessel-react-router/types"
import { Outlet } from "react-router-dom"

/** Renders the router view component. */
export function RouterView({ context }: RouterViewProps) {
  return <Outlet context={context} />
}
