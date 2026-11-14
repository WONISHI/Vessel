import { useContext, useSyncExternalStore, type ReactNode } from "react"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { FileIconScope, subscribe, snapshot } from "./state"
import { fileIconURL, resolveFileIcon } from "./resolve"
export function FileThemeIcon({ name, directory = false, expanded = false, root = false, className, fallback }: { name: string; directory?: boolean; expanded?: boolean; root?: boolean; className?: string; fallback: ReactNode }) {
  const current = useSyncExternalStore(subscribe, snapshot, snapshot)
  const scope = useContext(FileIconScope)
  const dark = useDarkAppearance()
  const enabled = scope === "resources" ? current.fileIconResources : current.fileIconWorkspace
  const theme = enabled ? current.fileIconTheme ?? "default" : "default"
  const icon = resolveFileIcon(theme, name, { directory, expanded, root, dark })
  const src = icon && fileIconURL(theme, icon, current.catppuccinFlavor, dark)
  return src ? <img alt="" aria-hidden draggable={false} src={src} data-file-icon-theme={theme} data-tree-icon={directory ? "folder" : "file"} className={className} /> : <>{fallback}</>
}
