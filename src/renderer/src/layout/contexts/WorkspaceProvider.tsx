import type { ReactNode } from "react"
import { WorkspaceContext, type WorkspaceContextType } from "../types/workspace"

export function WorkspaceProvider({ children, value }: { children: ReactNode; value: WorkspaceContextType }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
