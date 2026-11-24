import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react"
import { newTab, type Tab } from "./components/index-shared"
import { pinnedTabsFirst } from "./tab-order"

type WindowTabs = { tabs: Tab[]; active: string; partition: string }
type Windows = { user: WindowTabs; private?: WindowTabs; incognito: boolean }

/** Keep both windows alive, but expose and persist only the appropriate collection. */
export function useBrowserWindows(initial: { tabs: Tab[]; activeId: string }) {
  const [windows, render] = useState<Windows>(() => ({ user: { tabs: pinnedTabsFirst(initial.tabs), active: initial.activeId, partition: "persist:vessel-browser" }, incognito: false }))
  const current = useRef(windows)
  const pending = useRef(false)
  const mounted = useRef(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    mounted.current = true
    clearTimeout(closeTimer.current)
    return () => {
      mounted.current = false
      closeTimer.current = setTimeout(() => {
        if (current.current.private) void window.electronAPI.closeBrowserPrivateSession().catch(console.error)
      }, 0)
    }
  }, [])
  const change = useCallback((update: (value: Windows) => Windows) => {
    current.current = update(current.current)
    render(current.current)
  }, [])
  const setTabs = useCallback((update: SetStateAction<Tab[]>, opener?: string) => change(value => {
    const key = opener ? value.private?.tabs.some(tab => tab.id === opener) ? "private" : "user" : value.incognito ? "private" : "user"
    const target = value[key]
    if (!target) return value
    const tabs = pinnedTabsFirst(typeof update === "function" ? update(target.tabs) : update)
    return { ...value, [key]: { ...target, tabs } }
  }), [change])
  const setAllTabs = useCallback((update: (tabs: Tab[]) => Tab[]) => change(value => ({ ...value,
    user: { ...value.user, tabs: update(value.user.tabs) },
    private: value.private && { ...value.private, tabs: update(value.private.tabs) }
  })), [change])
  const setActiveId = useCallback((id: string) => change(value => {
    const key = value.private?.tabs.some(tab => tab.id === id) ? "private" : "user"
    const target = value[key]
    if (!target?.tabs.some(tab => tab.id === id)) return value
    return { ...value, incognito: key === "private", [key]: { ...target, active: id } }
  }), [change])
  const enterIncognito = useCallback(async () => {
    if (pending.current) return
    if (current.current.private) { change(value => ({ ...value, incognito: true })); return }
    pending.current = true
    try {
      const partition = await window.electronAPI.createBrowserPrivateSession()
      if (!mounted.current) { await window.electronAPI.closeBrowserPrivateSession(); return }
      const tab = newTab()
      change(value => ({ ...value, private: { tabs: [tab], active: tab.id, partition }, incognito: true }))
    } finally { pending.current = false }
  }, [change])
  const switchUserWindow = useCallback(() => change(value => ({ ...value, incognito: false })), [change])
  const closeIncognito = useCallback(async () => {
    if (pending.current || !current.current.private) return
    pending.current = true
    try {
      await window.electronAPI.closeBrowserPrivateSession()
      change(value => ({ user: value.user, incognito: false }))
    } finally { pending.current = false }
  }, [change])
  const selected = windows.incognito ? windows.private! : windows.user
  return { tabs: selected.tabs, active: selected.active, setTabs, setAllTabs, setActiveId,
    allTabs: [...windows.user.tabs, ...(windows.private?.tabs || [])], userWindow: windows.user,
    privateWindow: windows.private, incognito: windows.incognito, enterIncognito, switchUserWindow, closeIncognito }
}
