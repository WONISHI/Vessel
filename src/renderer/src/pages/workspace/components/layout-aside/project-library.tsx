import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { useLibraryMeta, updateLibraryMeta, readLibraryMeta } from "@/pages/resources/library-state"
import { useEffect, useRef, useState } from "react"
import { Ellipsis, FolderOpen, HardDriveUpload, HardDrive, Plus, X, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useWorkspace } from "../../hooks/useWorkspace"
import WorkspaceTree from "./layout-workspace-sidebar/workspace-tree"
import { useWorkspaceController } from "../../hooks/useWorkspaceController"
import { WorkspaceProvider } from "../../contexts/WorkspaceProvider"
import { useNavigate } from "react-router-dom"

type Project = { name: string; path: string }
export function ProjectLibrary({ pinned, onPin }: { pinned: boolean; onPin: () => void }) {
  const { workspace } = useWorkspace()
  const [selected, setSelected] = useState<Project>(() => {
    try { return JSON.parse(localStorage.getItem("resource_current_project") || "null") || workspace } catch { return workspace }
  })
  return <ProjectPreview key={selected.path} project={selected} onSelect={setSelected} pinned={pinned} onPin={onPin} />
}
function ProjectPreview({ project, onSelect, onPin }: { project: Project; onSelect: (project: Project) => void; pinned: boolean; onPin: () => void }) {
  const meta = useLibraryMeta()
  const isPinned = !!meta.pins?.some(item => item.path === project.path)
  const controller = useWorkspaceController({ ...project, files: [] }, undefined, "resources", true)
  const navigate = useNavigate()
  const enter = (initialFile?: string) => {
    localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [], initialFile }))
    window.dispatchEvent(new CustomEvent("vessel:resource-changed"))
    onPin()
    navigate(initialFile ? "/resources/file" : "/resources")
  }
  return <WorkspaceProvider value={{ ...controller, openWorkspaceFile: file => enter(file.path) }}>
    <ProjectLibraryContent pinned={isPinned} onPin={() => {
      const pins = (meta.pins || []).filter(item => item.path !== project.path)
      if (isPinned) updateLibraryMeta({ pins, lastPinned: meta.lastPinned?.path === project.path ? pins.at(-1) : meta.lastPinned })
      else { updateLibraryMeta({ pins: [...pins, project], lastPinned: project }); enter() }
    }} onSelect={onSelect} />
  </WorkspaceProvider>
}
function ProjectLibraryContent({ pinned, onPin, onSelect }: { pinned: boolean; onPin: () => void; onSelect: (project: Project) => void }) {
  const { workspace } = useWorkspace()
  const [projects, setProjects] = useState<Project[]>([{ name: workspace.name, path: workspace.path }])
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const [revision, setRevision] = useState(0)
  const writes = useRef(Promise.resolve())
  useEffect(() => {
    let cancelled = false
    void window.electronAPI.getAppState<Project[]>("project-library").then(saved => {
      if (cancelled) return
      const valid = Array.isArray(saved) ? saved.filter(p => typeof p.path === "string" && typeof p.name === "string") : []
      setProjects(valid.some(p => p.path === workspace.path) ? valid : [...valid, { name: workspace.name, path: workspace.path }])
      setReady(true)
    }).catch(reason => { if (!cancelled) { setError(String(reason)); setReady(true) } })
    return () => { cancelled = true }
  }, [workspace.path, workspace.name])
  useEffect(() => {
    if (ready) updateLibraryMeta({ count: projects.length })
    if (ready) writes.current = writes.current.catch(() => {}).then(() => window.electronAPI.setAppState("project-library", projects)).catch(reason => setError(String(reason)))
  }, [projects, ready])
  const activate = (project: Project) => {
    localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [] }))
    onSelect(project)
  }
  const add = async () => {
    try {
      const project = await window.electronAPI.openDirectory()
      if (!project) return
      const next = projects.some(p => p.path === project.path) ? projects : [...projects, { name: project.name, path: project.path }]
      await writes.current
      await window.electronAPI.setAppState("project-library", next)
      setProjects(next)
      activate(project)
    } catch (reason) { setError(String(reason)) }
  }
  const visible = projects.slice(0, 3)
  if (!visible.some(p => p.path === workspace.path)) { const current = projects.find(p => p.path === workspace.path); if (current) visible.splice(2, 1, current) }
  const overflow = projects.filter(p => !visible.includes(p))
  return <section aria-label="项目资源库" className="flex h-full min-h-0 flex-col bg-white">
    <header className="flex items-center gap-1 border-b px-2 py-2">
      <div className="flex min-w-0 flex-1 gap-1 overflow-hidden">
        {visible.map(project => <div key={project.path} className={`group relative flex min-w-0 items-center rounded-md ${project.path === workspace.path ? "max-w-[160px] flex-[1.5_1_0%] bg-green-50 text-green-700" : "max-w-[128px] flex-[1_1_0%] text-stone-500"}`}>
          <button title={project.path} className="min-w-0 flex-1 truncate px-2 py-1 text-xs" onClick={() => activate(project)}>{project.name}</button>
          {project.path !== workspace.path && <button aria-label={`关闭项目 ${project.name}`} className="absolute right-0 rounded bg-white px-1 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => {
            setProjects(list => list.filter(p => p.path !== project.path))
            const meta = readLibraryMeta()
            const pins = (meta.pins || []).filter(p => p.path !== project.path)
            updateLibraryMeta({ pins, lastPinned: meta.lastPinned?.path === project.path ? pins.at(-1) : meta.lastPinned })
          }}><X size={12} /></button>}
        </div>)}
      </div>
      {!!overflow.length && <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" aria-label="更多项目" className="size-6 p-0 hover:bg-green-600 hover:!text-white data-[state=open]:bg-green-600 data-[state=open]:!text-white"><Ellipsis className="!size-4" /></Button></PopoverTrigger><PopoverContent className="w-48 p-1"><ScrollArea className="max-h-72 [&_[data-radix-scroll-area-viewport]>div]:!block">{overflow.map(project => <button key={project.path} title={project.path} className="block w-full truncate rounded px-2 py-2 text-left text-xs hover:bg-green-50" onClick={() => activate(project)}>{project.name}</button>)}</ScrollArea></PopoverContent></Popover>}
      <Button variant="ghost" size="icon" className="size-6 hover:bg-emerald-700 hover:!text-white active:bg-emerald-700 active:!text-white" aria-label="添加项目或附件目录" disabled={!ready} onClick={() => void add()}><Plus className="!size-3.5" /></Button>
      <Button variant="ghost" size="icon" className={`size-6 hover:bg-emerald-700 hover:!text-white active:bg-emerald-700 active:!text-white ${pinned ? "bg-emerald-700 !text-white" : ""}`} aria-label={pinned ? "取消固定资源库" : "固定资源库"} onClick={onPin}>{pinned ? <HardDrive className="!size-3.5" /> : <HardDriveUpload className="!size-3.5" />}</Button>
    </header>
    <div className="flex items-center gap-2 border-b p-3">
      <FolderOpen className="size-5 shrink-0 text-green-600" />
      <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold">{workspace.name}</h2><p className="truncate text-[10px] text-stone-400" title={workspace.path}>{workspace.path}</p></div>
      <Button variant="ghost" size="icon" className="size-6 hover:bg-emerald-700 hover:!text-white active:bg-emerald-700 active:!text-white" aria-label="刷新资源库" onClick={() => setRevision(n => n + 1)}><RefreshCw className="!size-3.5" /></Button>
    </div>
    {error && <p role="alert" className="p-2 text-xs text-red-500">{error}</p>}
    <ScrollArea viewportRef={setViewport} className="min-h-0 flex-1 p-2"><WorkspaceTree key={`${workspace.path}:${revision}`} viewport={viewport} /></ScrollArea>
    <div className="border-t px-3 py-2 text-[10px] text-stone-400">{projects.length} 个项目 / 附件目录</div>
  </section>
}
