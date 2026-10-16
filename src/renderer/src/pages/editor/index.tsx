import { CurrentEditor } from "@/pages/editor/components/current-editor"
import { ExternalEditor } from "@/pages/editor/components/external-editor"
import { useLocation } from "react-router-dom"

/** Renders the editor route component. */
export function EditorRoute() {
  const location = useLocation()
  const external = new URLSearchParams(location.search).get("external")
  if (external)
    return (
      <ExternalEditor
        key={external}
        path={external}
      />
    )
  return <CurrentEditor />
}
