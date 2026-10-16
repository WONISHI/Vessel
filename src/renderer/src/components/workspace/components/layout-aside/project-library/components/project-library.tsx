import { Project } from "@/components/workspace/components/layout-aside/project-library/components/project-library-shared"
import { ProjectPreview } from "@/components/workspace/components/layout-aside/project-library/components/project-preview"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import { useState } from "react"

/** Renders the project library component. */
export function ProjectLibrary({ pinned, onPin }: { pinned: boolean; onPin: () => void }) {
  const { workspace } = useWorkspace()
  const [selected, setSelected] = useState<Project>(() => {
    try {
      return JSON.parse(localStorage.getItem("resource_current_project") || "null") || workspace
    } catch {
      return workspace
    }
  })
  return (
    <ProjectPreview
      key={selected.path}
      project={selected}
      onSelect={setSelected}
      pinned={pinned}
      onPin={onPin}
    />
  )
}
