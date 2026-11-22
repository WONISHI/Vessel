import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react"
import type { WebviewTag } from "electron"
import type { Tab } from "./components/index-shared"

export const TAB_FREEZE_AFTER = 4 * 60 * 60 * 1000
export const TAB_FREEZE_CHECK_INTERVAL = 60 * 1000

export function freezeBrowserTab(tab: Tab): Tab {
  return { ...tab, frozen: true, ready: false, loading: false, back: false, forward: false, error: "", devError: undefined, videoPlaying: false, mediaPlaying: false }
}

/** Keep tab metadata, but release its guest and obsolete navigation/loading state. */
export function freezeIdleTabs(tabs: Tab[], active: string, canFreeze: (id: string) => boolean, now = Date.now()) {
  let changed = false
  const next = tabs.map((tab) => {
    if (tab.id === active || tab.frozen || !tab.url || tab.loading || tab.videoPlaying || tab.mediaPlaying ||
      !Number.isFinite(tab.lastActiveAt) || now - tab.lastActiveAt! < TAB_FREEZE_AFTER || !canFreeze(tab.id)) return tab
    changed = true
    return freezeBrowserTab(tab)
  })
  return changed ? next : tabs
}

export function wakeBrowserTab(tab: Tab, now = Date.now()): Tab {
  return tab.frozen
    ? { ...tab, frozen: false, lastActiveAt: now, ready: false, loading: Boolean(tab.url), back: false, forward: false, error: "", devError: undefined }
    : { ...tab, lastActiveAt: now }
}

/** Unmounting the guest releases its renderer; selecting the retained tab recreates it. */
export function useTabFreezing(active: string, setTabs: Dispatch<SetStateAction<Tab[]>>, views: RefObject<Map<string, WebviewTag>>) {
  useEffect(() => {
    const check = () => setTabs((tabs) => freezeIdleTabs(tabs, active, (id) => {
      const view = views.current.get(id)
      if (!view?.isConnected) return false
      try { return !view.isDevToolsOpened() } catch { return false }
    }))
    const timer = window.setInterval(check, TAB_FREEZE_CHECK_INTERVAL)
    // Also sweep after the machine wakes or the app returns from the background.
    window.addEventListener("focus", check)
    return () => { window.clearInterval(timer); window.removeEventListener("focus", check) }
  }, [active, setTabs, views])
}
