import type { ReactNode } from "react"
import { WorkspaceContext, type WorkspaceContextType } from "@/pages/workspace/types/workspace"

export function WorkspaceProvider({ children, value }: { children: ReactNode; value: WorkspaceContextType }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
