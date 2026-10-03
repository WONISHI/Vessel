import { useSyncExternalStore } from "react"
type BrowserTab = { id: string; title: string; active: boolean }
let tabs: BrowserTab[] = []
const listeners = new Set<() => void>()
export function publishBrowserTabs(value: BrowserTab[]) { tabs = value; listeners.forEach(listener => listener()) }
export function useBrowserTabs() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => tabs) }
export function selectBrowserTab(id: string) { window.dispatchEvent(new CustomEvent('vessel-browser-tab', { detail: id })) }
