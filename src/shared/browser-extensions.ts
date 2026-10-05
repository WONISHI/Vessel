export type BrowserExtension = { key: string; path: string; name: string; version: string; enabled: boolean; extensionId?: string; error?: string; managedDirectory?: string; archiveDigest?: string; pinned?: boolean; icon?: string; popup?: string; optionsPage?: string; devtoolsPage?: string; permissions?: string[] }
export interface BrowserExtensionsAPI {
  extensionScroll(top?: number): Promise<{height: number; top: number}>
  resizeBrowserExtension(bounds: {x: number; y: number; width: number; height: number}): Promise<void>
  onBrowserExtensionClosed(callback: () => void): () => void
  closeBrowserExtension(): Promise<void>
  pinBrowserExtension(key: string, pinned: boolean): Promise<BrowserExtension[]>
  openBrowserExtension(key: string, mode?: "open" | "options" | "inspect"): Promise<{ kind: "dialog" | "devtools" | "background"; message?: string }>
  listBrowserExtensions(): Promise<BrowserExtension[]>
  installBrowserExtension(kind?: "archive" | "directory"): Promise<BrowserExtension[]>
  setBrowserExtensionEnabled(key: string, enabled: boolean): Promise<BrowserExtension[]>
  removeBrowserExtension(key: string): Promise<BrowserExtension[]>
}
