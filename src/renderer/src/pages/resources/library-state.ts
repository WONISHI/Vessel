import { useMemo, useSyncExternalStore } from "react"
export type LibraryProject = { name: string; path: string }
type LibraryMeta = { count?: number; pins?: LibraryProject[]; lastPinned?: LibraryProject; recent?: LibraryProject[] }
const key = "resource-library-meta"
const event = "vessel:library-meta"

/** Subscribes to subscribe. */
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(event, listener)
    window.removeEventListener("storage", listener)
  }
}

/** Performs the snapshot operation. */
const snapshot = () => localStorage.getItem(key) || "{}"

/** Reads library meta. */
export function readLibraryMeta(): LibraryMeta {
  try {
    return JSON.parse(snapshot())
  } catch {
    return {}
  }
}

/** Updates library meta. */
export function updateLibraryMeta(patch: Partial<LibraryMeta>) {
  localStorage.setItem(key, JSON.stringify({ ...readLibraryMeta(), ...patch }))
  window.dispatchEvent(new Event(event))
}

/** Most recently opened projects, deduplicated by path. */
export function rememberLibraryProject(project: LibraryProject) {
  if (!project?.path || !project.name) return
  const recent = readLibraryMeta().recent || []
  if (recent[0]?.path === project.path && recent[0].name === project.name) return
  updateLibraryMeta({ recent: [{ name: project.name, path: project.path }, ...recent.filter(item => item.path !== project.path)].slice(0, 5) })
}

/** Provides the library meta hook. */
export function useLibraryMeta() {
  const value = useSyncExternalStore(subscribe, snapshot)
  return useMemo(() => {
    try {
      return JSON.parse(value) as LibraryMeta
    } catch {
      return {} as LibraryMeta
    }
  }, [value])
}

/** Selects last pinned. */
export function selectLastPinned() {
  const project = readLibraryMeta().lastPinned
  if (!project) return false
  localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [] }))
  window.dispatchEvent(new Event("vessel:resource-changed"))
  return true
}
