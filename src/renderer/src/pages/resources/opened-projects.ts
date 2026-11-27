import { useMemo, useSyncExternalStore } from "react"
import type { LibraryProject } from "./library-state"

// This window's open projects are separate from the persistent library and recents.
const key = "resource-open-projects"
const event = "vessel:opened-resource-projects"
const snapshot = () => sessionStorage.getItem(key) || "[]"
const subscribe = (listener: () => void) => {
  window.addEventListener(event, listener)
  return () => window.removeEventListener(event, listener)
}
function parse(value: string): LibraryProject[] {
  try {
    const projects = JSON.parse(value)
    return Array.isArray(projects) ? projects.filter(item => typeof item?.name === "string" && typeof item?.path === "string" && item.path) : []
  } catch { return [] }
}
export function rememberOpenedResourceProject(project: LibraryProject) {
  if (!project.path || !project.name) return
  const projects = parse(snapshot())
  const previous = projects.find(item => item.path === project.path)
  if (previous?.name === project.name) return
  const next = previous ? projects.map(item => item.path === project.path ? { name: project.name, path: project.path } : item) : [...projects, { name: project.name, path: project.path }]
  sessionStorage.setItem(key, JSON.stringify(next))
  window.dispatchEvent(new Event(event))
}
export function isOpenedResourceProject(path: string) {
  return parse(snapshot()).some(project => project.path === path)
}
export function useOpenedResourceProjects() {
  const value = useSyncExternalStore(subscribe, snapshot)
  return useMemo(() => parse(value), [value])
}
