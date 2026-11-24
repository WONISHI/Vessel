export type HistoryEntry = {
  id: number
  url: string
  title: string
  visitedAt: number
  bookmarked?: boolean | number
  favicon?: string | null
}

export type BrowserDevice = {
  title: string
  width: number
  height: number
  deviceScaleFactor: number
  mobile: boolean
  userAgent: string
}

export type BrowserDownloadEntry = { id: number; name: string; path: string; size: number; savedAt: number; source: "download" | "save" }

export type BrowserSavedFile = { name: string; url: string; source: "download" | "save" }

export interface BrowserToolsAPI {
  setBrowserDevtoolsTransition(token: number, active: boolean): Promise<{ id: number; image: string } | undefined>
  createBrowserPrivateSession(): Promise<string>
  closeBrowserPrivateSession(): Promise<void>
  listBrowserDownloads(): Promise<BrowserDownloadEntry[]>
  previewBrowserDownload(id: number): Promise<string>
  revealBrowserDownload(id: number): Promise<void>
  onBrowserDownloadsUpdated(callback: () => void): () => void
  onBrowserFileSaved(callback: (file: BrowserSavedFile) => void): () => void
  syncBrowserBookmarks(items: { url: string; title: string }[]): Promise<void>
  getBrowserBookmarks(): Promise<{ url: string; title: string }[]>
  onBrowserBookmarksUpdated(callback: (items: { url: string; title: string }[]) => void): () => void
  listBrowserHistory(): Promise<HistoryEntry[]>
  deleteBrowserHistory(id: number | null): Promise<void>
  reloadBrowserTab(id: number): Promise<void>
  printBrowserPage(id: number): Promise<void>
  listBrowserDevices(): Promise<BrowserDevice[]>
  emulateBrowserDevice(id: number, device: BrowserDevice | null): Promise<void>
}
