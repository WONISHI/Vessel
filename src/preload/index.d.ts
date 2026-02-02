import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown,
    electronAPI: {
      openDirectory: () => Promise<WorkspaceData | null>,
      readContent: (path: string) => Promise<string>,
      saveContent: (path: string, content: string) => Promise<boolean>
    }
  }
}
