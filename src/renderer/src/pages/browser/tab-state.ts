import { useSyncExternalStore } from "react"
type BrowserTab = { id: string; title: string; url: string; favicon?: string; active: boolean }
let tabs: BrowserTab[] = []
const listeners = new Set<() => void>()

/** Performs the publish browser tabs operation. */
export function publishBrowserTabs(value: BrowserTab[]) {
  tabs = value
  listeners.forEach((listener) => listener())
}

/** Provides the browser tabs hook. */
export function useBrowserTabs() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => tabs
  )
}

/** Selects browser tab. */
export function selectBrowserTab(id: string) {
  window.dispatchEvent(new CustomEvent("vessel-browser-tab", { detail: id }))
}

/** Performs the browser tab action operation. */
export function browserTabAction(action: "new" | "close", id?: string) {
  window.dispatchEvent(new CustomEvent("vessel-browser-tab-action", { detail: { action, id } }))
}
