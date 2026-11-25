import { useEffect, useState } from "react"

export function useProxyEnabled() {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => {
    let alive = true
    const update = () => {
      void window.electronAPI.getSettings().then(settings => {
        if (alive) setEnabled(!!settings.proxyEnabled)
      }).catch(() => {})
    }
    update()
    window.addEventListener("vessel:settings-saved", update)
    return () => { alive = false; window.removeEventListener("vessel:settings-saved", update) }
  }, [])
  return enabled
}
