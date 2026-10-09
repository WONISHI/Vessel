import { CommandPalette } from "@/components/command-palette"
import { applyAppearance } from "@/pages/settings/appearance"
import { TransitPanel } from "@/components/transit/panel"
import { OfficeKeepAlive } from "@/pages/office"
import { BrowserKeepAlive } from "@/pages/browser/keep-alive"
import { useEffect } from "react"
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
  useEffect(() => {
    const apply = () => { void window.electronAPI.getSettings().then(applyAppearance).catch(console.error) }
    apply()
    const media = matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])
  useEffect(() => {
    let queue = Promise.resolve()
    const open = (path: string) => {
      queue = queue.then(async () => {
        if (/\.(pdf|docx?|docs|xlsx?|pptx?|odt|ods|odp|csv)$/i.test(path)) {
          const pending = JSON.parse(sessionStorage.getItem("office-pending-paths") || "[]") as string[]
          sessionStorage.setItem("office-pending-paths", JSON.stringify([...pending, path]))
          window.dispatchEvent(new Event("vessel:office-open"))
          await router.push("/office")
          return
        }
        const name = path.split(/[\\/]/).pop() || path
        const parent = path.slice(0, -name.length)
        const root = /^[A-Za-z]:[\\/]$/.test(parent) ? parent : parent.replace(/[\\/]$/, "") || "/"
        const project = { name: root.split(/[\\/]/).pop() || root, path: root }
        const projects = await window.electronAPI.getAppState<Array<typeof project>>("project-library") || []
        if (!projects.some(item => item.path === root)) await window.electronAPI.setAppState("project-library", [...projects, project])
        localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [], initialFile: path }))
        window.dispatchEvent(new Event("vessel:resource-changed"))
        await router.push("/resources/file")
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
