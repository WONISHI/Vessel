import { useSyncExternalStore } from "react"
type BrowserTab = { frozen?: boolean; id: string; title: string; url: string; favicon?: string; active: boolean }
let tabs: BrowserTab[] = []
let incognito = false
const listeners = new Set<() => void>()

/** Performs the publish browser tabs operation. */
export function publishBrowserTabs(value: BrowserTab[], privateWindow = false) {
  tabs = value
  incognito = privateWindow
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
export function browserTabAction(action: "new" | "close", id?: string, url?: string) {
  window.dispatchEvent(new CustomEvent("vessel-browser-tab-action", { detail: { action, id, url } }))
}


/** Expose the active browser window mode to the shared titlebar, including blank private tabs. */
export function useBrowserIncognito() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => incognito
  )
}
