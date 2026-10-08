import { CommandPalette } from "@/components/command-palette"
import { applyAppearance } from "@/pages/settings/appearance"
import { TransitPanel } from "@/components/transit/panel"
import { OfficeKeepAlive } from "@/pages/office"
import { BrowserKeepAlive } from "@/pages/browser/keep-alive"
import { useEffect } from "react"
import { useRouter } from "@vessel/react-router"
import { Toaster } from "sonner"

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
    const open = (path: string) => { void router.push(`/editor/file?external=${encodeURIComponent(path)}`) }
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
    return unsubscribe
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
