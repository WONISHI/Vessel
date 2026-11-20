import type { Tab } from "@/pages/browser/components/index-shared"

/** Visual grouping only: original tabs, order, webviews and pin state remain intact. */
export function groupBrowserTabs(tabs: Tab[], activeId: string, enabled: boolean) {
  const groups: { key: string; members: Tab[]; tab: Tab }[] = []
  const byHost = new Map<string, typeof groups[number]>()
  for (const tab of tabs) {
    let host = ""
    if (enabled) {
      try {
        const url = new URL(tab.url)
        if (url.protocol === "http:" || url.protocol === "https:") host = url.hostname.toLowerCase().replace(/\.$/, "")
      } catch { /* New tabs and local resources stay separate. */ }
    }
    const key = host ? `${tab.pinned ? "pinned" : "normal"}:${host}` : tab.id
    const existing = host ? byHost.get(key) : undefined
    if (existing) {
      existing.members.push(tab)
      if (tab.id === activeId) existing.tab = tab
    } else {
      const group = { key, members: [tab], tab }
      groups.push(group)
      if (host) byHost.set(key, group)
    }
  }
  return groups
}
