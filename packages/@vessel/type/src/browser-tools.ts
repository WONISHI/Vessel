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
export type BrowserDevtoolsLanguage = "zh" | "en-US"

export type BrowserFrameInfo = {
  id: string; documentURL: string; depth: number; src: string; resolvedSrc: string
  name: string; title: string; elementId: string; sandbox: string; srcdoc: boolean
}
export type BrowserFramesSnapshot = {
  pageURL: string; total: number; items: BrowserFrameInfo[]; unreadableDocuments: number; truncated: boolean
}

export interface BrowserToolsAPI {
  listBrowserFrames(id: number): Promise<BrowserFramesSnapshot>
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
  stopBrowserTab(id: number): Promise<void>
  printBrowserPage(id: number): Promise<void>
  listBrowserDevices(): Promise<BrowserDevice[]>
  emulateBrowserDevice(id: number, device: BrowserDevice | null): Promise<void>
}
