export interface BrowserProxyStatus {
  connected: boolean
  busy: boolean
  stage: string
  nodes: string[]
  selected: string
  hasSubscription: boolean
  error?: string
}
export interface BrowserProxyAPI {
  browserProxySubscription(): Promise<string>
  saveBrowserProxySubscription(url: string): Promise<void>
  browserProxyStatus(): Promise<BrowserProxyStatus>
  connectBrowserProxy(subscription?: string): Promise<BrowserProxyStatus>
  disconnectBrowserProxy(): Promise<BrowserProxyStatus>
  selectBrowserProxy(node: string): Promise<BrowserProxyStatus>
}
