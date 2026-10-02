import { TransitPanel } from "@/components/transit/panel"
import { OfficeKeepAlive } from "@/pages/office"
import { BrowserKeepAlive } from "@/pages/browser/keep-alive"
import { useEffect } from "react"
import { useRouter } from "@vessel/react-router"
import { Toaster } from "sonner"

import DevTool from "@/components/core/devtool"
import { RouterView } from "@vessel/react-router/components"

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

      <BrowserKeepAlive />
      <OfficeKeepAlive />
      <RouterView />
      <TransitPanel />
    </>
  )
}

export default App
