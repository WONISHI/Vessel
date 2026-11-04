import type { PerformanceSnapshot } from '@vessel/type'
import { useEffect, useState } from 'react'
export type PerformancePoint = { time: number; total: number; main: number; renderer: number }
export type RendererDiagnostic = { heapUsed?: number; heapLimit?: number; domNodes: number; editors: number; codeEditors: number; documentTabs: number; hiddenTabs: number; iframes: number; webviews: number; longTasks: number; longestTaskMs: number }

/** Bound history to two minutes, poll serially and observe only this renderer's long tasks. */
export function usePerformance() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null)
  const [history, setHistory] = useState<PerformancePoint[]>([])
  const [renderer, setRenderer] = useState<RendererDiagnostic | null>(null)
  const [fps, setFps] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    let disposed = false, pending = false, frame = 0, frames = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let started = performance.now(), longTasks = 0, longestTaskMs = 0
    let observer: PerformanceObserver | undefined
    if (typeof PerformanceObserver !== 'undefined' && PerformanceObserver.supportedEntryTypes?.includes('longtask')) {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) { longTasks++; longestTaskMs = Math.max(longestTaskMs, entry.duration) }
      })
      observer.observe({ type: 'longtask' })
    }
    const poll = async () => {
      if (disposed || document.hidden || pending) return
      pending = true
      try {
        const next = await window.electronAPI.getPerformanceSnapshot()
        if (!disposed && !document.hidden) {
          setSnapshot(next); setError('')
          setHistory((previous) => [...previous, { time: next.sampledAt, total: next.memoryBytes, main: next.processes.find((item) => item.type === 'Browser')?.memoryBytes ?? 0, renderer: next.processes.filter((item) => item.type === 'Tab').reduce((sum, item) => sum + item.memoryBytes, 0) }].slice(-120))
          const heap = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
          setRenderer({ heapUsed: heap?.usedJSHeapSize, heapLimit: heap?.jsHeapSizeLimit, domNodes: document.getElementsByTagName('*').length, editors: document.querySelectorAll('.vditor-ir .vditor-reset').length, codeEditors: document.querySelectorAll('.monaco-editor').length, documentTabs: document.querySelectorAll('[data-document-tab]').length, hiddenTabs: document.querySelectorAll('[data-document-tab][aria-hidden="true"]').length, iframes: document.querySelectorAll('iframe').length, webviews: document.querySelectorAll('webview').length, longTasks, longestTaskMs })
        }
      } catch (reason) { if (!disposed) setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { pending = false; if (!disposed && !document.hidden) timer = setTimeout(() => void poll(), 1000) }
    }
    const tick = (time: number) => {
      frames++
      if (time - started >= 1000) { setFps(Math.round(frames * 1000 / (time - started))); frames = 0; started = time }
      frame = requestAnimationFrame(tick)
    }
    const resume = () => {
      clearTimeout(timer); cancelAnimationFrame(frame); setVisible(!document.hidden); setFps(null)
      if (!document.hidden) { frames = 0; started = performance.now(); frame = requestAnimationFrame(tick); void poll() }
    }
    if (!document.hidden) { frame = requestAnimationFrame(tick); void poll() }
    document.addEventListener('visibilitychange', resume)
    return () => { disposed = true; clearTimeout(timer); cancelAnimationFrame(frame); observer?.disconnect(); document.removeEventListener('visibilitychange', resume) }
  }, [])
  return { snapshot, history, renderer, fps, error, visible }
}
