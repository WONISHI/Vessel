import type { RouteLocationRaw } from "#vessel-react-router/types"
import { type LinkProps, type NavLinkProps } from "react-router-dom"
export interface RouterLinkProps extends Omit<LinkProps, "to"> {
  to: RouteLocationRaw
}
export interface RouterNavLinkProps extends Omit<NavLinkProps, "to"> {
  to: RouteLocationRaw
}
