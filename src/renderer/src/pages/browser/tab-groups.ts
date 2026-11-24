import type { Tab } from "@/pages/browser/components/index-shared"

/** Group local files together and web pages by hostname without changing tab/webview identity. */
export function groupBrowserTabs(tabs: Tab[], activeId: string, enabled: boolean) {
  const groups: { key: string; kind: "local" | "domain" | "single"; members: Tab[]; tab: Tab }[] = []
  const byIdentity = new Map<string, typeof groups[number]>()
  for (const tab of tabs) {
    let identity = ""
    let kind: "local" | "domain" | "single" = "single"
    if (enabled) {
      try {
        const url = new URL(tab.url)
        if (url.protocol === "file:") {
          identity = "local-resources"
          kind = "local"
        } else if (url.protocol === "http:" || url.protocol === "https:") {
          identity = url.hostname.toLowerCase().replace(/\.$/, "")
          kind = "domain"
        }
      } catch { /* Blank and malformed addresses remain individual tabs. */ }
    }
    // All local resources share one group, including files from different folders or pin states.
    const key = identity ? kind === "local" ? identity : `${tab.pinned ? "pinned" : "normal"}:${identity}` : tab.id
    const existing = identity ? byIdentity.get(key) : undefined
    if (existing) {
      existing.members.push(tab)
      if (tab.id === activeId || (existing.tab.id !== activeId && (tab.lastActiveAt ?? 0) > (existing.tab.lastActiveAt ?? 0))) existing.tab = tab
    } else {
      const group = { key, kind, members: [tab], tab }
      groups.push(group)
      if (identity) byIdentity.set(key, group)
    }
  }
  return groups
}
