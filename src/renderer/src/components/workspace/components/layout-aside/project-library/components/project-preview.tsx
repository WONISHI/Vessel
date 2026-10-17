import { ProjectLibraryContent } from "@/components/workspace/components/layout-aside/project-library/components/project-library-content"
import { Project } from "@/components/workspace/components/layout-aside/project-library/components/project-library-shared"
import { WorkspaceProvider } from "@/components/workspace/contexts/WorkspaceProvider"
import { useWorkspaceController } from "@/components/workspace/hooks/useWorkspaceController"
import { updateLibraryMeta, useLibraryMeta } from "@/pages/resources/library-state"
import { useNavigate } from "react-router-dom"

/** Renders the project preview component. */
export function ProjectPreview({ project, onSelect, onPin }: { project: Project; onSelect: (project: Project) => void; pinned: boolean; onPin: () => void }) {
  const meta = useLibraryMeta()
  const isPinned = meta.lastPinned?.path === project.path && !!meta.pins?.some((item) => item.path === project.path)
  const controller = useWorkspaceController({ ...project, files: [] }, undefined, "resources", true)
  const navigate = useNavigate()

  /** Performs the enter operation. */
  const enter = (initialFile?: string) => {
    localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [], initialFile }))
    window.dispatchEvent(new CustomEvent("vessel:resource-changed"))
    onPin()
    navigate(initialFile ? "/resources/file" : "/resources")
  }
  return (
    <WorkspaceProvider
      value={{
        ...controller,

        /** Opens workspace file. */
        openWorkspaceFile: (file) => enter(file.path)
      }}
    >
      <ProjectLibraryContent
        pinned={isPinned}
        onPin={() => {
          const pins = (meta.pins || []).filter((item) => item.path !== project.path)
          if (isPinned) updateLibraryMeta({ pins, lastPinned: meta.lastPinned?.path === project.path ? pins.at(-1) : meta.lastPinned })
          else {
            updateLibraryMeta({ pins: [...pins, project], lastPinned: project })
            enter()
          }
        }}
        onSelect={onSelect}
      />
    </WorkspaceProvider>
  )
}
