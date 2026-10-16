import { RouterLinkProps } from "#vessel-react-router/components/components-shared"
import { useRouter } from "#vessel-react-router/hooks"
import { forwardRef } from "react"
import { Link } from "react-router-dom"

/** Renders the router link component. */
export const RouterLink = forwardRef<HTMLAnchorElement, RouterLinkProps>(function RouterLink({ to, state, ...props }, ref) {
  const router = useRouter()
  const resolved = router.resolve(to)
  const targetState = typeof to === "object" && to.state !== undefined ? to.state : state

  return (
    <Link
      {...props}
      ref={ref}
      to={resolved.fullPath}
      state={targetState}
    />
  )
})
