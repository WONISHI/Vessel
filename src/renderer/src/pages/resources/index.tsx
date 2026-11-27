import { transitionPage } from "@/lib/page-transition"
import { rememberOpenedResourceProject } from "./opened-projects"
import Layout from "@/components/layout/index"
import ActivityBar from "@/components/layout/activity-bar/index"
import { ProjectLibrary } from "@/components/workspace/components/layout-aside/project-library/components/project-library"
import { RouteLoading } from "@/components/ui/route-loading"
import { useNavigate } from "react-router-dom"
import WorkspacePage from "@/components/workspace/index"
import type { WorkspaceData } from "@vessel/type"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { readLibraryMeta, rememberLibraryProject } from "./library-state"

function readSelectedProject(): (WorkspaceData & { initialFile?: string }) | null {
  try {
    const value = JSON.parse(localStorage.getItem('resource_current_project') || 'null')
    return typeof value?.path === 'string' && value.path && typeof value.name === 'string' && value.name ? { ...value, files: Array.isArray(value.files) ? value.files : [] } : null
  } catch { return null }
}

function EmptyResourceLibrary({ onAdded }: { onAdded: (project: { name: string; path: string }) => void }) {
  const navigate = useNavigate()
  return <Layout aside={<ActivityBar activity="resources" onActivityChange={id => navigate(id === 'files' ? '/editor' : id === 'tools' ? '/devtools' : id === 'postman' ? '/api-client' : `/${id}`)} />}>
    <div className="min-w-0 flex-1"><ProjectLibrary pinned onPin={() => {}} onProjectAdded={onAdded} /></div>
  </Layout>
}

/** Renders the resource route component. */
export function ResourceRoute() {
  const [project, setProject] = useState(readSelectedProject)
  const [restoring, setRestoring] = useState(() => !readSelectedProject())
  const currentPath = useRef(project?.path)
  useLayoutEffect(() => { currentPath.current = project?.path }, [project?.path])
  useEffect(() => {
    if (!restoring) return
    let disposed = false
    void window.electronAPI.getAppState<Array<{ name: string; path: string }>>('project-library').then(saved => {
      if (disposed || currentPath.current) return
      const projects = Array.isArray(saved) ? saved.filter(item => typeof item?.name === 'string' && item.name && typeof item.path === 'string' && item.path) : []
      const selected = projects.find(item => item.path === readLibraryMeta().lastPinned?.path) ?? projects[0]
      if (selected) {
        const next = { name: selected.name, path: selected.path, files: [] }
        localStorage.setItem('resource_current_project', JSON.stringify(next))
        setProject(next)
      }
    }).catch(error => { if (!disposed) console.error('读取项目资源库失败', error) }).finally(() => { if (!disposed) setRestoring(false) })
    return () => { disposed = true }
  }, [restoring])
  useEffect(() => {
    if (project?.path && project.name) { rememberLibraryProject(project); rememberOpenedResourceProject(project) }
  }, [project?.path, project?.name])
  useEffect(() => {
    /** Refreshes the current state. */
    const update = () => {
      const next = readSelectedProject()
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
      {!project && (restoring ? <RouteLoading activity="resources" skeleton /> : <EmptyResourceLibrary onAdded={data => setProject({ ...data, files: [] })} />)}
    </>
  )
}
