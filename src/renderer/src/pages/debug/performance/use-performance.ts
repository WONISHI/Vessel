import type { PerformanceSnapshot } from "@vessel/type"
import { useEffect, useState } from "react"

/** Poll only while visible; serialize IPC and discard results after unmount. */
export function usePerformance() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null)
  const [fps, setFps] = useState<number | null>(null)
  const [error, setError] = useState("")
  const [visible, setVisible] = useState(!document.hidden)

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let frames = 0
    let started = performance.now()
    let pending = false

    const poll = async () => {
      if (disposed || document.hidden || pending) return
      pending = true
      try {
        const next = await window.electronAPI.getPerformanceSnapshot()
        if (!disposed && !document.hidden) {
          setSnapshot(next)
          setError("")
        }
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : String(reason))
      } finally {
        pending = false
        if (!disposed && !document.hidden) timer = setTimeout(() => void poll(), 1000)
      }
    }
    const tick = (time: number) => {
      frames++
      const elapsed = time - started
      if (elapsed >= 1000) {
        setFps(Math.round(frames * 1000 / elapsed))
        frames = 0
        started = time
      }
      frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      setVisible(!document.hidden)
      setFps(null)
      if (!document.hidden) {
        frames = 0
        started = performance.now()
        frame = requestAnimationFrame(tick)
        void poll()
      }
    }
    if (!document.hidden) {
      frame = requestAnimationFrame(tick)
      void poll()
    }
    document.addEventListener("visibilitychange", resume)
    return () => {
      disposed = true
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [])

  return { snapshot, fps, error, visible }
}
