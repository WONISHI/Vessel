import { setSearchEngine } from "@/pages/browser/url"
import { addTransitFile } from "@/components/transit/state"
import { CommandPalette } from "@/components/command-palette"
import { applyAppearance } from "@/pages/settings/appearance"
import { TransitPanel } from "@/components/transit/panel"
import { OfficeKeepAlive } from "@/pages/office"
import { BrowserKeepAlive } from "@/pages/browser/keep-alive"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"
import { useRouter } from "@vessel/react-router"
import { Toaster, toast } from "sonner"

import DevTool from "@/components/core/devtool"
import { WorkspaceRouteCache } from "./router/workspace-route-cache"

export interface WorkspaceData {
  name: string
  path: string
  files: Array<{
    name: string
    path: string
  }>
}

function App() {
  const router = useRouter()
  const location = useLocation()
  useEffect(() => {
    if (location.pathname === "/settings") return
    const update = () => {
      let root: string | null = null
      try { root = JSON.parse(localStorage.getItem("app_current_workspace") || "null")?.path || null } catch {}
      if (location.pathname.startsWith("/resources")) root = null
      void window.electronAPI.setBackupWorkspace(root).then(() => window.dispatchEvent(new Event("vessel:sync-context"))).catch(console.error)
    }
    update()
    window.addEventListener("vessel:workspace-changed", update)
    return () => window.removeEventListener("vessel:workspace-changed", update)
  }, [location.pathname])
  useEffect(() => {
    const apply = () => { void window.electronAPI.getSettings().then(settings => { applyAppearance(settings); setSearchEngine(settings.searchEngine || "bing") }).catch(console.error) }
    apply()
    window.addEventListener("vessel:settings-saved", apply)
    const media = matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", apply)
    return () => { media.removeEventListener("change", apply); window.removeEventListener("vessel:settings-saved", apply) }
  }, [])
  useEffect(() => {
    let queue = Promise.resolve()
    const open = (path: string) => {
      queue = queue.then(async () => {
        const entry = await window.electronAPI.getExternalPathInfo(path)
        if (entry.kind === "file" && /\.(pdf|docx?|docs|xlsx?|pptx?|odt|ods|odp|csv)$/i.test(entry.name)) {
          const pending = JSON.parse(sessionStorage.getItem("office-pending-paths") || "[]") as string[]
          sessionStorage.setItem("office-pending-paths", JSON.stringify([...pending, entry.path]))
          window.dispatchEvent(new Event("vessel:office-open"))
          await router.push("/office")
          return
        }
        if (entry.kind === "file") {
          addTransitFile(entry.root, entry.path, entry.name)
          return
        }
        const project = { name: entry.name, path: entry.path }
        const projects = await window.electronAPI.getAppState<Array<typeof project>>("project-library") || []
        if (!projects.some(item => item.path === entry.path)) await window.electronAPI.setAppState("project-library", [...projects, project])
        localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [] }))
        window.dispatchEvent(new Event("vessel:resource-changed"))
        await router.push("/resources")
        await new Promise(resolve => setTimeout(resolve, 30))
      }).catch(error => { toast.error(String(error)) })
    }
    const drag = (event: DragEvent) => { if (event.dataTransfer?.types.includes("Files")) event.preventDefault() }
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return
      event.preventDefault()
      for (const file of event.dataTransfer.files) { const path = window.electronAPI.getDroppedFilePath(file); if (path) open(path) }
    }
    window.addEventListener("dragover", drag)
    window.addEventListener("drop", drop)
    const unsubscribe = window.electronAPI.onOpenMarkdown(open)
    void window.electronAPI.takePendingMarkdownFiles().then(async paths => {
      if (paths.length) { paths.forEach(open); return }
      if (window.location.hash && window.location.hash !== "#/" && window.location.hash !== "#") return
      const last = await window.electronAPI.getAppState<WorkspaceData>("workspace-last")
      if (last?.path) {
        localStorage.setItem("app_current_workspace", JSON.stringify(last))
        void router.push("/editor")
      }
    }).catch(console.error)
    return () => { unsubscribe(); window.removeEventListener("dragover", drag); window.removeEventListener("drop", drop) }
  }, [router])
  return (
    <>
      <Toaster
        position="top-center"
        richColors
        closeButton
      />

      <DevTool />
      <CommandPalette />

      <BrowserKeepAlive />
      <OfficeKeepAlive />
      <WorkspaceRouteCache />
      <TransitPanel />
    </>
  )
}

export default App
