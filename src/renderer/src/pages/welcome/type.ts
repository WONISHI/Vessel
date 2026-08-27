export interface WorkspaceData {
  name: string
  path: string
  files: Array<{ name: string; path: string }>
}

export interface HomePageProps {
  onEnter?: (data: WorkspaceData) => void
}
