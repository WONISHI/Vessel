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
    void window.electronAPI.takePendingMarkdownFiles().then(paths => paths.forEach(open))
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

      <RouterView />
    </>
  )
}

export default App
