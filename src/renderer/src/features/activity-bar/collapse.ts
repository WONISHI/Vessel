import { getLayoutOverride, subscribeLayoutScope, updateLayoutOverride } from "@/features/layout/visibility-scope"
import { useSyncExternalStore } from "react"

const KEY = "vessel-activity-bar-collapsed"
const listeners = new Set<() => void>()
let collapsed = (() => { try { return localStorage.getItem(KEY) === "true" } catch { return false } })()
const subscribe = (listener: () => void) => { listeners.add(listener); const off = subscribeLayoutScope(listener); return () => { listeners.delete(listener); off() } }

export function setActivityBarCollapsed(value: boolean) {
  if (updateLayoutOverride({ activityCollapsed: value })) return
  collapsed = value
  try { localStorage.setItem(KEY, String(value)) } catch { /* Storage may be unavailable. */ }
  listeners.forEach((listener) => listener())
}

/** Shared by every page's activity bar and title bar controls. */
export function useActivityBarCollapsed() {
  return useSyncExternalStore(subscribe, () => getLayoutOverride()?.activityCollapsed ?? collapsed, () => getLayoutOverride()?.activityCollapsed ?? collapsed)
}
