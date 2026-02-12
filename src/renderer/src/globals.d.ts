import { ElectronAPI } from "@electron-toolkit/preload"

interface WorkspaceData {
  name: string
  path: string
  files: Array<{ name: string; path: string }>
}

declare module "react-dczs-image-preview"
declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
    // 新增对 electronAPI 的声明
    electronAPI: {
      openDirectory: () => Promise<WorkspaceData | null>
    }
  }
}
