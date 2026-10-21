export interface SystemInfo {
  platform: string
  arch: string
  osRelease: string
  locale: string
  electronVersion: string
  storageBytes: number
  display: { width: number; height: number; scaleFactor: number }
}
