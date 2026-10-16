import Welcome from "@/components/workspace-welcome/index"
import { saveCurrentWorkspace } from "@/router/components/index-shared"

/** Renders the welcome route component. */
export function WelcomeRoute() {
  return <Welcome onEnter={saveCurrentWorkspace} />
}
