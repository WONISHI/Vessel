import { RouterNavLinkProps } from "#vessel-react-router/components/components-shared"
import { useRouter } from "#vessel-react-router/hooks"
import { forwardRef } from "react"
import { NavLink } from "react-router-dom"

/** Renders the router nav link component. */
export const RouterNavLink = forwardRef<HTMLAnchorElement, RouterNavLinkProps>(function RouterNavLink({ to, state, ...props }, ref) {
  const router = useRouter()
  const resolved = router.resolve(to)
  const targetState = typeof to === "object" && to.state !== undefined ? to.state : state

  return (
    <NavLink
      {...props}
      ref={ref}
      to={resolved.fullPath}
      state={targetState}
    />
  )
})
