import { createContext, useContext, useSyncExternalStore } from "react"
import type { AppSettings } from "@vessel/type"
export const FileIconScope = createContext<"workspace" | "resources">("workspace")
type Settings = Pick<AppSettings, "fileIconTheme" | "fileIconWorkspace" | "fileIconResources" | "catppuccinFlavor" | "fileTypeBadgesEnabled" | "fileTypeBadgesWorkspace" | "fileTypeBadgesResources">
let settings: Settings = { fileIconTheme: "default", fileIconWorkspace: false, fileIconResources: true, catppuccinFlavor: "auto", fileTypeBadgesEnabled: false, fileTypeBadgesWorkspace: false, fileTypeBadgesResources: true }
const listeners = new Set<() => void>()
export function setFileIconSettings(value: Settings) {
  const next: Settings = { fileIconTheme: value.fileIconTheme ?? "default", fileIconWorkspace: value.fileIconWorkspace ?? false, fileIconResources: value.fileIconResources ?? true, catppuccinFlavor: value.catppuccinFlavor ?? "auto", fileTypeBadgesEnabled: value.fileTypeBadgesEnabled ?? false, fileTypeBadgesWorkspace: value.fileTypeBadgesWorkspace ?? false, fileTypeBadgesResources: value.fileTypeBadgesResources ?? true }
  if (JSON.stringify(next) === JSON.stringify(settings)) return
  settings = next
  listeners.forEach((listener) => listener())
}
export const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const snapshot = () => settings

export function useShowFileTypeBadges(): boolean {
  const value = useSyncExternalStore(subscribe, snapshot, snapshot)
  const scope = useContext(FileIconScope)
  return value.fileTypeBadgesEnabled === true && (scope === "resources" ? value.fileTypeBadgesResources !== false : value.fileTypeBadgesWorkspace === true)
}
