import { useEffect, useState, type ReactNode } from 'react'
import type { AppRouter } from '@vessel/react-router'
import { RouterProvider } from '@vessel/react-router/components'

/** Mount the router so its guards can run, retaining the boot UI while they await remote data. */
export function ReadyRouter({ router, fallback }: { router: AppRouter; fallback: ReactNode }) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    void router.isReady().then(() => { if (active) setReady(true) })
    return () => { active = false }
  }, [router])
  return <><RouterProvider router={router} />{!ready && fallback}</>
}
