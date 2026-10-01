export type BrowserExtension = { key: string; path: string; name: string; version: string; enabled: boolean; extensionId?: string; error?: string }
export interface BrowserExtensionsAPI {
  listBrowserExtensions(): Promise<BrowserExtension[]>
  installBrowserExtension(): Promise<BrowserExtension[]>
  setBrowserExtensionEnabled(key: string, enabled: boolean): Promise<BrowserExtension[]>
  removeBrowserExtension(key: string): Promise<BrowserExtension[]>
}
