import { Toaster } from "sonner"

import DevTool from "@/components/core/devtool"
import { RouterView } from "@/lib/react-router/components"

export interface WorkspaceData {
  name: string
  path: string
  files: Array<{
    name: string
    path: string
  }>
}

function App() {
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
