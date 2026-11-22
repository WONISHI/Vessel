import { useEffect, useState } from "react"

export function useResourceStickyScroll(resources: boolean) {
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    if (!resources) return
    let alive = true, revision = 0
    const refresh = () => {
      const request = ++revision
      void window.electronAPI?.getSettings?.().then((settings) => {
        if (alive && request === revision) setEnabled(settings.resourceTreeStickyScroll !== false)
      }).catch(console.error)
    }
    refresh()
    window.addEventListener("vessel:settings-saved", refresh)
    return () => { alive = false; window.removeEventListener("vessel:settings-saved", refresh) }
  }, [resources])
  return resources && enabled
}
