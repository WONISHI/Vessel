import { useEffect, useMemo, useState } from "react"

/** Avoid flashing a spinner for reads that finish before a frame or two. */
export function useDelayedLoading(loading: boolean, delay = 180) {
  const cycle = useMemo(() => ({ loading }), [loading])
  const [visibleCycle, setVisibleCycle] = useState<typeof cycle | null>(null)
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setVisibleCycle(cycle), delay)
    return () => clearTimeout(timer)
  }, [loading, cycle, delay])
  return loading && visibleCycle === cycle
}
