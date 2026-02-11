export interface LayoutProps {
  children?: React.ReactNode
  workspace: {
    name: string
    path: string
    files: Array<{ name: string; path: string }>
  }
}
