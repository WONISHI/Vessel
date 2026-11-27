import { isOpenedResourceProject, rememberOpenedResourceProject } from "./opened-projects"
import { projectCache } from "@/components/workspace/components/layout-aside/project-library/components/project-library-shared"
import { readLibraryMeta, rememberLibraryProject, updateLibraryMeta, type LibraryProject } from "./library-state"

/** Seed history from existing directory-open records for projects already in the library. */
export async function refreshRecentResourceProjects() {
  if (!window.electronAPI?.getAppState || !window.electronAPI?.getRecentWorkspaces) return
  const [saved, records] = await Promise.all([
    window.electronAPI.getAppState<LibraryProject[]>("project-library"),
    window.electronAPI.getRecentWorkspaces(100)
  ])
  const paths = new Set((Array.isArray(saved) ? saved : []).map(item => item.path))
  const recent = readLibraryMeta().recent || []
  const combined = [...recent, ...records.filter(item => paths.has(item.path) && item.isAvailable !== false).sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt))]
  const seen = new Set<string>()
  updateLibraryMeta({ recent: combined.filter(item => {
    if (!item.path || !item.name || seen.has(item.path)) return false
    seen.add(item.path)
    return true
  }).slice(0, 5).map(({ name, path }) => ({ name, path })) })
}

/** Add a project to the library and activate it in the resource workspace. */
export async function openResourceProject(project: LibraryProject) {
  // Switching an open/cached project is a window-local action. In remote mode
  // reading and rewriting the unchanged library added two network round trips.
  if (!isOpenedResourceProject(project.path) && !projectCache.projects?.some(item => item.path === project.path)) {
    const saved = await window.electronAPI.getAppState<LibraryProject[]>("project-library")
    const projects = Array.isArray(saved) ? saved.filter(item => typeof item?.path === "string" && typeof item?.name === "string") : []
    const exists = projects.some(item => item.path === project.path)
    const next = exists ? projects : [...projects, { name: project.name, path: project.path }]
    if (!exists) await window.electronAPI.setAppState("project-library", next)
    projectCache.projects = next
    updateLibraryMeta({ count: next.length })
  }
  rememberLibraryProject(project)
  rememberOpenedResourceProject(project)
  localStorage.setItem("resource_current_project", JSON.stringify({ name: project.name, path: project.path, files: [] }))
  window.dispatchEvent(new Event("vessel:resource-changed"))
}
