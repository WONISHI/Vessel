import { useEffect, useState } from "react"

/** Defers restored background guests until first selection, retaining visited guests across tab switches. */
export function useActivatedTabs(active: string, tabs: { id: string }[]) {
  const [activated, setActivated] = useState(() => new Set([active]))
  useEffect(() => {
    setActivated((previous) => {
      const next = new Set(tabs.filter((tab) => tab.id === active || previous.has(tab.id)).map((tab) => tab.id))
      if (next.size === previous.size && [...next].every((id) => previous.has(id))) return previous
      return next
    })
  }, [active, tabs])
  return new Set([...activated, active])
}
