import { useContext, useState, type ReactNode } from "react"
import { UNSAFE_LocationContext, useLocation, useOutlet } from "react-router-dom"

/** Keep visited workspaces mounted, including their nested route and frozen location. */
export function WorkspaceRouteCache() {
  const location = useLocation()
  const context = useContext(UNSAFE_LocationContext)
  const outlet = useOutlet()
  const active = ["/editor", "/resources"].find(path => location.pathname === path || location.pathname.startsWith(path + "/"))
  const [entries, setEntries] = useState<Record<string, { key: string; outlet: ReactNode; context: typeof context }>>({})
  if (active && entries[active]?.key !== location.key) {
    setEntries(previous => ({ ...previous, [active]: { key: location.key, outlet, context } }))
  }
  return <>
    {["/editor", "/resources"].map(path => {
      const entry = entries[path]
      return <div key={path} hidden={active !== path} style={{ display: active === path ? "contents" : "none" }}>
        {entry && <UNSAFE_LocationContext.Provider value={active === path ? context : entry.context}>{active === path ? outlet : entry.outlet}</UNSAFE_LocationContext.Provider>}
      </div>
    })}
    {!active && outlet}
  </>
}
