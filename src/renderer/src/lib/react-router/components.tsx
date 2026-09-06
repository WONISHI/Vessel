import { forwardRef } from "react"
import {
  Link,
  NavLink,
  Outlet,
  RouterProvider as ReactRouterProvider,
  type LinkProps,
  type NavLinkProps
} from "react-router-dom"

import { useRouter } from "./hooks"
import {
  AppRouterContext,
  type RouterController
} from "./router"
import type {
  RouteLocationRaw,
  RouterProviderProps,
  RouterViewProps
} from "./types"

export function RouterProvider({ router }: RouterProviderProps) {
  const controller = router as RouterController

  return (
    <AppRouterContext.Provider value={controller}>
      <ReactRouterProvider router={controller.nativeRouter} />
    </AppRouterContext.Provider>
  )
}

export function RouterView({ context }: RouterViewProps) {
  return <Outlet context={context} />
}

export interface RouterLinkProps extends Omit<LinkProps, "to"> {
  to: RouteLocationRaw
}

export const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(
  function RouterLink({ to, state, ...props }, ref) {
    const router = useRouter()
    const resolved = router.resolve(to)
    const targetState =
      typeof to === "object" && to.state !== undefined
        ? to.state
        : state

    return (
      <Link
        {...props}
        ref={ref}
        to={resolved.fullPath}
        state={targetState}
      />
    )
  }
)

export interface RouterNavLinkProps extends Omit<NavLinkProps, "to"> {
  to: RouteLocationRaw
}

export const RouterNavLink = forwardRef<
  HTMLAnchorElement,
  RouterNavLinkProps
>(function RouterNavLink({ to, state, ...props }, ref) {
  const router = useRouter()
  const resolved = router.resolve(to)
  const targetState =
    typeof to === "object" && to.state !== undefined
      ? to.state
      : state

  return (
    <NavLink
      {...props}
      ref={ref}
      to={resolved.fullPath}
      state={targetState}
    />
  )
})
