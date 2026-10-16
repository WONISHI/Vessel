export interface WorkspaceData {
  id: number
  name: string
  path: string
  files: Array<{ name: string; path: string }>
  deviceId: string
  sessionId: string
  firstOpenedAt: string
  lastOpenedAt: string
  openedAt: string
  openCount: number
}

export interface HomePageProps {
  onEnter?: (data: WorkspaceData) => void
}
