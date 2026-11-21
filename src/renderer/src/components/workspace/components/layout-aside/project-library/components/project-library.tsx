import { Project, projectCache } from "@/components/workspace/components/layout-aside/project-library/components/project-library-shared"
import { ProjectPreview } from "@/components/workspace/components/layout-aside/project-library/components/project-preview"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { rememberLibraryProject, updateLibraryMeta } from "@/pages/resources/library-state"
import { FolderPlus } from "lucide-react"
import { useEffect, useState } from "react"

/** Resource projects are explicitly added, independently of the current editor workspace. */
export function ProjectLibrary({ pinned, onPin }: { pinned: boolean; onPin: () => void }) {
  const pick = (projects: Project[]) => {
    let previous: Project | null = null
    try { previous = JSON.parse(localStorage.getItem("resource_current_project") || "null") } catch { /* Ignore an invalid cached selection. */ }
    return projects.find((item) => item.path === previous?.path) ?? projects[0] ?? null
  }
  const [selected, setSelected] = useState<Project | null>(() => (projectCache.projects ? pick(projectCache.projects) : null))
  const [ready, setReady] = useState(() => projectCache.projects !== null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let cancelled = false
    void window.electronAPI.getAppState<Project[]>("project-library").then((saved) => {
      if (cancelled) return
      const projects = Array.isArray(saved) ? saved.filter((item) => typeof item?.path === "string" && typeof item?.name === "string") : []
      projectCache.projects = projects
      setSelected(pick(projects))
      updateLibraryMeta({ count: projects.length })
    }).catch((reason) => { if (!cancelled) setError(String(reason)) }).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])
  const add = async () => {
    setBusy(true)
    setError("")
    try {
      const project = await window.electronAPI.openDirectory()
      if (!project) return
      const saved = await window.electronAPI.getAppState<Project[]>("project-library")
      const projects = Array.isArray(saved) ? saved : []
      const next = projects.some((item) => item.path === project.path) ? projects : [...projects, { name: project.name, path: project.path }]
      await window.electronAPI.setAppState("project-library", next)
      localStorage.setItem("resource_current_project", JSON.stringify({ name: project.name, path: project.path, files: [] }))
      rememberLibraryProject(project)
      projectCache.projects = next
      updateLibraryMeta({ count: next.length })
      setSelected(project)
    } catch (reason) { setError(String(reason)) }
    finally { setBusy(false) }
  }
  if (selected) return <ProjectPreview key={selected.path} project={selected} onSelect={setSelected} pinned={pinned} onPin={onPin} />
  if (!ready && !error) return (
    <section aria-label="项目资源库" aria-busy="true" className="flex h-full min-h-0 flex-col bg-white dark:bg-[#22272e]">
      <header className="border-b p-3 text-sm font-semibold">项目资源库</header>
      <div role="status" aria-label="正在读取项目目录" className="space-y-3 p-3">
        <span className="sr-only">正在读取项目目录</span>
        {Array.from({ length: 8 }, (_, index) => <div key={index} aria-hidden="true" className="flex items-center gap-2"><Skeleton className="size-4 shrink-0" /><Skeleton className={index % 2 ? "h-4 w-3/5" : "h-4 w-4/5"} /></div>)}
      </div>
    </section>
  )
  return (
    <section aria-label="项目资源库" className="flex h-full min-h-0 flex-col bg-white dark:bg-[#22272e]">
      <header className="border-b p-3 text-sm font-semibold">项目资源库</header>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-5 text-center">
        <FolderPlus className="size-8 text-stone-400" />
        <p className="text-xs text-stone-400">还没有项目目录</p>
        <p className="text-[11px] text-stone-400">添加独立的项目或附件目录，便于随时访问。</p>
        <Button size="sm" disabled={!ready || busy} onClick={() => void add()}><FolderPlus className="size-4" />添加项目目录</Button>
        {error && <p role="alert" className="break-all text-xs text-red-500">{error}</p>}
      </div>
    </section>
  )
}
