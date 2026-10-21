import type { SystemInfo } from "@vessel/type"
import { useEffect, useState } from "react"

function readWindowInfo() {
  return { width: window.innerWidth, height: window.innerHeight, pixelRatio: window.devicePixelRatio, online: navigator.onLine, language: navigator.language }
}

export function useSystemInfo() {
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [windowInfo, setWindowInfo] = useState(readWindowInfo)
  const [error, setError] = useState("")
  useEffect(() => {
    let disposed = false
    let pending = false
    const updateWindow = () => setWindowInfo(readWindowInfo())
    const refresh = async () => {
      if (disposed || pending || document.hidden) return
      pending = true
      updateWindow()
      try {
        const next = await window.electronAPI.getSystemInfo()
        if (!disposed) { setInfo(next); setError("") }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      } finally { pending = false }
    }
    const onVisible = () => { if (!document.hidden) void refresh() }
    void refresh()
    const timer = setInterval(() => void refresh(), 5000)
    window.addEventListener("resize", updateWindow)
    window.addEventListener("online", updateWindow)
    window.addEventListener("offline", updateWindow)
    window.addEventListener("languagechange", updateWindow)
    window.addEventListener("focus", onVisible)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      disposed = true
      clearInterval(timer)
      window.removeEventListener("resize", updateWindow)
      window.removeEventListener("online", updateWindow)
      window.removeEventListener("offline", updateWindow)
      window.removeEventListener("languagechange", updateWindow)
      window.removeEventListener("focus", onVisible)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
  return { info, windowInfo, error }
}
