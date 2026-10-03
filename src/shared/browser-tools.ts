export type HistoryEntry = { id: number; url: string; title: string; visitedAt: number; favicon?: string | null }
export type BrowserDevice = { title: string; width: number; height: number; deviceScaleFactor: number; mobile: boolean; userAgent: string }
export interface BrowserToolsAPI {
  listBrowserHistory(): Promise<HistoryEntry[]>
  deleteBrowserHistory(id: number | null): Promise<void>
  printBrowserPage(id: number): Promise<void>
  listBrowserDevices(): Promise<BrowserDevice[]>
  emulateBrowserDevice(id: number, device: BrowserDevice | null): Promise<void>
}
