import { useCallback, useContext, useSyncExternalStore } from "react"
import type { AppSettings } from "@vessel/type"
import { defaultDirectoryTreeSettings, normalizeDirectoryTreeSettings } from "@vessel/utils"
import { FileIconScope } from "@/features/file-icons/state"

export type DirectoryTreeScope = "workspace" | "resources"
export type DirectoryTreeLayout = {
  compact: boolean; guides: boolean; folderBold: boolean; sidebarWidth: number; rowHeight: number
  fontSize: number; indent: number; gap: number; iconSize: number; columnGap: number; padding: number; fontFamily: string
}
let settings = normalizeDirectoryTreeSettings(defaultDirectoryTreeSettings)
let font = "Plus Jakarta Sans"
let initialized = false
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const notify = () => listeners.forEach((listener) => listener())
const createLayout = (scope: DirectoryTreeScope): DirectoryTreeLayout => {
  const dimension = settings[scope]
  const workspace = scope === "workspace"
  const compact = settings.layoutEnabled && (workspace ? settings.layoutWorkspace : settings.layoutResources)
  return {
    compact,
    guides: settings.guidesEnabled && (workspace ? settings.guidesWorkspace : settings.guidesResources),
    folderBold: workspace ? settings.folderBoldWorkspace : settings.folderBoldResources,
    sidebarWidth: compact ? dimension.sidebarWidth : 280,
    rowHeight: compact ? dimension.rowHeight : 32,
    fontSize: compact ? dimension.fontSize : 11,
    indent: compact ? dimension.indent : 16,
    gap: settings.gapEnabled && (workspace ? settings.gapWorkspace : settings.gapResources) ? dimension.gap : 0,
    iconSize: compact ? 16 : 14, columnGap: compact ? 4 : 8, padding: compact ? 6 : 8,
    fontFamily: compact ? "system-ui, sans-serif" : `"${font}", system-ui, sans-serif`
  }
}
let layouts = { workspace: createLayout("workspace"), resources: createLayout("resources") }
const widths: Partial<Record<DirectoryTreeScope, number>> = {}
const widthKey = (scope: DirectoryTreeScope) => `vessel-sidebar-width-${scope}`
const loadWidth = (scope: DirectoryTreeScope, configured: number) => {
  try {
    const raw = localStorage.getItem(widthKey(scope))
    if (raw) {
      const saved = JSON.parse(raw)
      return saved.configured === configured && Number.isFinite(saved.width) ? Math.max(232, Math.min(600, saved.width)) : configured
    }
    const legacy = Number(localStorage.getItem("vessel-sidebar-width"))
    return configured === 280 && Number.isFinite(legacy) && legacy > 0 ? Math.max(232, Math.min(600, legacy)) : configured
  } catch { return configured }
}

/** Called with saved appearance settings; immutable snapshots keep scope changes local. */
export function setDirectoryTreeSettings(value: Pick<AppSettings, "directoryTree" | "font">) {
  const next = normalizeDirectoryTreeSettings(value.directoryTree)
  const nextFont = value.font || "Plus Jakarta Sans"
  const changed = JSON.stringify(next) !== JSON.stringify(settings) || font !== nextFont
  settings = next
  font = nextFont
  if (changed || !initialized) {
    for (const scope of ["workspace", "resources"] as const) {
      const previous = layouts[scope], layout = createLayout(scope)
      if (!initialized) widths[scope] = loadWidth(scope, layout.sidebarWidth)
      else if (layout.sidebarWidth !== previous.sidebarWidth) {
        widths[scope] = layout.sidebarWidth
        try { localStorage.setItem(widthKey(scope), JSON.stringify({ width: layout.sidebarWidth, configured: layout.sidebarWidth })) } catch { /* Storage may be unavailable. */ }
      }
      if (JSON.stringify(previous) !== JSON.stringify(layout)) layouts = { ...layouts, [scope]: layout }
    }
    initialized = true
    notify()
  }
}

export function getDirectoryTreeLayout(scope: DirectoryTreeScope) { return layouts[scope] }
export function useDirectoryTreeLayout(explicitScope?: DirectoryTreeScope) {
  const inheritedScope = useContext(FileIconScope)
  const scope = explicitScope || inheritedScope
  return useSyncExternalStore(subscribe, () => layouts[scope], () => layouts[scope])
}
export function useDirectoryTreeSidebarWidth() {
  const scope = useContext(FileIconScope)
  const getWidth = () => widths[scope] ?? loadWidth(scope, layouts[scope].sidebarWidth)
  const width = useSyncExternalStore(subscribe, getWidth, getWidth)
  const setWidth = useCallback((value: number) => {
    if (!Number.isFinite(value)) return
    const width = Math.max(232, Math.min(600, Math.round(value)))
    widths[scope] = width
    try { localStorage.setItem(widthKey(scope), JSON.stringify({ width, configured: layouts[scope].sidebarWidth })) } catch { /* Storage may be unavailable. */ }
    notify()
  }, [scope])
  return [width, setWidth] as const
}
