import { WorkspaceContext, type WorkspaceContextType } from "@/components/workspace/types/workspace"
import type { ReactNode } from "react"

/** Renders the workspace provider component. */
export function WorkspaceProvider({ children, value }: { children: ReactNode; value: WorkspaceContextType }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
