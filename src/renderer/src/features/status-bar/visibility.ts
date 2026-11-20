import { useSyncExternalStore } from "react"

const KEY = "vessel-status-bar-visible"
const listeners = new Set<() => void>()
const read = () => { try { return localStorage.getItem(KEY) !== "false" } catch { return true } }
let visible = read()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }

export function setStatusBarVisible(value: boolean) {
  visible = value
  try { localStorage.setItem(KEY, String(value)) } catch { /* Storage may be unavailable. */ }
  listeners.forEach((listener) => listener())
}

// Keep independent preview windows in sync with the main window.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY && event.key !== null) return
  visible = read()
  listeners.forEach((listener) => listener())
})

export function useStatusBarVisible() {
  return useSyncExternalStore(subscribe, () => visible, () => visible)
}
