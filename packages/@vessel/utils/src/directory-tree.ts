import type { DirectoryTreeDimensions, DirectoryTreeSettings } from "@vessel/type"

export const directoryTreeLimits = {
  sidebarWidth: { min: 232, max: 600 },
  rowHeight: { min: 20, max: 48 },
  fontSize: { min: 10, max: 20 },
  indent: { min: 0, max: 40 },
  gap: { min: 0, max: 24 }
} as const
export const defaultDirectoryTreeSettings: DirectoryTreeSettings = {
  layoutEnabled: true, layoutWorkspace: true, layoutResources: true,
  guidesEnabled: true, guidesWorkspace: true, guidesResources: true,
  gapEnabled: true, gapWorkspace: true, gapResources: true,
  folderBoldWorkspace: false, folderBoldResources: false,
  workspace: { sidebarWidth: 280, rowHeight: 22, fontSize: 13, indent: 8, gap: 0 },
  resources: { sidebarWidth: 280, rowHeight: 22, fontSize: 13, indent: 8, gap: 0 }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** Merge legacy/partial imports and bound every number before it affects layout. */
export function normalizeDirectoryTreeSettings(input: unknown): DirectoryTreeSettings {
  const source = record(input)
  const flags = Object.fromEntries(Object.entries(defaultDirectoryTreeSettings).filter(([, value]) => typeof value === "boolean").map(([key, fallback]) => [key, typeof source[key] === "boolean" ? source[key] : fallback]))
  const dimensions = (scope: "workspace" | "resources"): DirectoryTreeDimensions => {
    const value = record(source[scope])
    const result = { ...defaultDirectoryTreeSettings[scope] }
    for (const key of Object.keys(directoryTreeLimits) as (keyof DirectoryTreeDimensions)[]) {
      const number = value[key], { min, max } = directoryTreeLimits[key]
      if (typeof number === "number" && Number.isFinite(number)) result[key] = Math.max(min, Math.min(max, Math.round(number)))
    }
    result.rowHeight = Math.max(result.rowHeight, result.fontSize + 4)
    return result
  }
  return { ...defaultDirectoryTreeSettings, ...flags, workspace: dimensions("workspace"), resources: dimensions("resources") }
}
