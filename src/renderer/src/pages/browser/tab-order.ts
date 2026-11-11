/** Keep pinned tabs before regular tabs while preserving order within each group. */
export function pinnedTabsFirst<T extends { pinned?: boolean }>(tabs: T[]): T[] {
  const firstRegular = tabs.findIndex((tab) => !tab.pinned)
  if (firstRegular < 0 || !tabs.slice(firstRegular).some((tab) => tab.pinned)) return tabs
  return [...tabs.filter((tab) => tab.pinned), ...tabs.filter((tab) => !tab.pinned)]
}
