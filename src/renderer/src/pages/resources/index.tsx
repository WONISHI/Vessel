import Welcome from "@/components/workspace-welcome/index"
import WorkspacePage from "@/components/workspace/index"
import type { WorkspaceData } from "@vessel/type"
import { useEffect, useState } from "react"

/** Renders the resource route component. */
export function ResourceRoute() {
  const [project, setProject] = useState(() => JSON.parse(localStorage.getItem("resource_current_project") || "null") as (WorkspaceData & { initialFile?: string }) | null)
  useEffect(() => {
    /** Refreshes the current state. */
    const update = () => setProject(JSON.parse(localStorage.getItem("resource_current_project") || "null"))
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
