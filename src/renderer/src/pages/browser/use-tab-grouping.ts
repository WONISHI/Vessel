import { useEffect, useState } from "react"

export function useTabGrouping() {
  const [enabled, setEnabled] = useState(true)
  useEffect(() => {
    let alive = true
    let revision = 0
    const refresh = () => {
      const request = ++revision
      void window.electronAPI?.getSettings?.().then(settings => {
        if (alive && request === revision) setEnabled(settings.browserGroupSameDomain !== false)
      }).catch(console.error)
    }
    refresh()
    window.addEventListener("vessel:settings-saved", refresh)
    return () => { alive = false; window.removeEventListener("vessel:settings-saved", refresh) }
  }, [])
  return enabled
}
