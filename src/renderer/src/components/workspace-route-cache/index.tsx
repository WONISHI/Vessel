import { useContext, useRef, useState, type ReactNode } from "react"
import { UNSAFE_LocationContext, useLocation, useOutlet } from "react-router-dom"

type CacheEntry = {
  key: string
  path: string
  outlet: ReactNode
  context: React.ContextType<typeof UNSAFE_LocationContext>
}

/** Keep visited workspaces mounted so tree selection, tabs, and scroll survive other routes. */
export function WorkspaceRouteCache() {
  const location = useLocation()
  const context = useContext(UNSAFE_LocationContext)
  const outlet = useOutlet()
  const active = ["/editor", "/resources"].find((path) => location.pathname === path || location.pathname.startsWith(path + "/"))
  const [entries, setEntries] = useState<Record<string, CacheEntry>>({})
  const previousActive = useRef(active)
  const pathKey = location.pathname + location.search

  if (active) {
    const existing = entries[active]
    const staying = previousActive.current === active
    // First visit, in-workspace navigation, or re-entering at a different URL: take the live outlet.
    // Re-entering the same URL must keep the mounted outlet so selection/UI state is not remounted.
    if (!existing || (staying && existing.key !== location.key) || (!staying && existing.path !== pathKey)) {
      setEntries((previous) => ({ ...previous, [active]: { key: location.key, path: pathKey, outlet, context } }))
    } else if (!staying && existing.key !== location.key) {
      setEntries((previous) => ({
        ...previous,
        [active]: { ...previous[active], key: location.key, context }
      }))
    }
  }
  previousActive.current = active

  return (
    <>
      {["/editor", "/resources"].map((path) => {
        const entry = entries[path]
        const show = active === path
        const node = entry?.outlet ?? (show ? outlet : null)
        return (
          <div
            key={path}
            hidden={!show}
            style={{ display: show ? "contents" : "none" }}
          >
            {node && (
              <UNSAFE_LocationContext.Provider value={show ? context : entry?.context}>
                {node}
              </UNSAFE_LocationContext.Provider>
            )}
          </div>
        )
      })}
      {!active && outlet}
    </>
  )
}
