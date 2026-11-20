import { useSyncExternalStore } from "react"

const KEY = "vessel-activity-bar-collapsed"
const listeners = new Set<() => void>()
let collapsed = (() => { try { return localStorage.getItem(KEY) === "true" } catch { return false } })()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export function setActivityBarCollapsed(value: boolean) {
  collapsed = value
  try { localStorage.setItem(KEY, String(value)) } catch { /* Storage may be unavailable. */ }
  listeners.forEach((listener) => listener())
}

/** Shared by every page's activity bar and title bar controls. */
export function useActivityBarCollapsed() {
  return useSyncExternalStore(subscribe, () => collapsed, () => collapsed)
}
