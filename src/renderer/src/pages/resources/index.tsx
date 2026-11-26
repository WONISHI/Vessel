import { transitionPage } from "@/lib/page-transition"
import { rememberOpenedResourceProject } from "./opened-projects"
import Welcome from "@/components/workspace-welcome/index"
import WorkspacePage from "@/components/workspace/index"
import type { WorkspaceData } from "@vessel/type"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { rememberLibraryProject } from "./library-state"

/** Renders the resource route component. */
export function ResourceRoute() {
  const [project, setProject] = useState(() => JSON.parse(localStorage.getItem("resource_current_project") || "null") as (WorkspaceData & { initialFile?: string }) | null)
  const currentPath = useRef(project?.path)
  useLayoutEffect(() => { currentPath.current = project?.path }, [project?.path])
  useEffect(() => {
    if (project?.path && project.name) { rememberLibraryProject(project); rememberOpenedResourceProject(project) }
  }, [project?.path, project?.name])
  useEffect(() => {
    /** Refreshes the current state. */
    const update = () => {
      const next = JSON.parse(localStorage.getItem("resource_current_project") || "null")
      if (next) { rememberLibraryProject(next); rememberOpenedResourceProject(next) }
      if (next?.path === currentPath.current) setProject(next)
      else void transitionPage(() => setProject(next), "resources", { contentReady: true }).catch(error => console.error("项目切换动效失败", error))
    }
    window.addEventListener("vessel:resource-changed", update)
    return () => window.removeEventListener("vessel:resource-changed", update)
  }, [])
  const [visited, setVisited] = useState<Record<string, WorkspaceData>>({})
  if (project && !visited[project.path]) setVisited((previous) => ({ ...previous, [project.path]: { name: project.name, path: project.path, files: [] } }))

  useEffect(() => {
    if (project?.initialFile) {
      try {
        const stored = JSON.parse(localStorage.getItem("resource_current_project") || "null")
        if (stored?.initialFile) {
          delete stored.initialFile
          localStorage.setItem("resource_current_project", JSON.stringify(stored))
        }
      } catch {}
      setProject((current) => (current ? { ...current, initialFile: undefined } : null))
    }
  }, [project])

  return (
    <>
      {Object.values(visited).map((entry) => (
        <div
          key={entry.path}
          hidden={entry.path !== project?.path}
          style={{ display: entry.path === project?.path ? "contents" : "none" }}
        >
          <WorkspacePage
            workspace={entry}
            initialFile={entry.path === project?.path ? project.initialFile : undefined}
            scope="resources"
            active={entry.path === project?.path}
          />
        </div>
      ))}
      {!project && (
        <Welcome
          onEnter={(data) => {
            localStorage.setItem("resource_current_project", JSON.stringify(data))
            setProject(data)
          }}
        />
      )}
    </>
  )
}
