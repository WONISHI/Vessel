export interface BrowserProxySubscriptionInfo { uploaded?: number; downloaded?: number; total?: number; expiresAt?: number; updatedAt: number }
export interface BrowserProxySubscription { id: string; name: string; url: string; info?: BrowserProxySubscriptionInfo }
export type BrowserProxyMode = "rule" | "global" | "direct"
export type BrowserProxyScope = "system" | "browser"
export interface BrowserProxyTraffic {
  uploadRate: number; downloadRate: number; uploaded: number; downloaded: number
  totalUploaded: number; totalDownloaded: number
  history: { time: number; upload: number; download: number }[]
}
export interface BrowserProxyRuntime {
  mode: BrowserProxyMode; scope: BrowserProxyScope; tun: boolean; tunAvailable: boolean; tunReason?: string
  traffic: BrowserProxyTraffic; trafficError?: string
}

export interface BrowserProxyStatus {
  runtime?: BrowserProxyRuntime
  subscriptionId?: string
  connected: boolean
  busy: boolean
  stage: string
  nodes: string[]
  selected: string
  hasSubscription: boolean
  error?: string
}

export interface BrowserProxyAPI {
  refreshBrowserProxySubscriptionInfo(id: string): Promise<BrowserProxySubscription>
  setBrowserProxyRuntime(input: { mode?: BrowserProxyMode; scope?: BrowserProxyScope; tun?: boolean }): Promise<BrowserProxyStatus>
  listBrowserProxySubscriptions(): Promise<BrowserProxySubscription[]>
  saveBrowserProxyProfile(input: { id?: string; name: string; url: string }): Promise<BrowserProxySubscription>
  deleteBrowserProxyProfile(id: string): Promise<void>
  connectBrowserProxyProfile(id: string): Promise<BrowserProxyStatus>
  browserProxySubscription(): Promise<string>
  saveBrowserProxySubscription(url: string): Promise<void>
  browserProxyStatus(): Promise<BrowserProxyStatus>
  connectBrowserProxy(subscription?: string): Promise<BrowserProxyStatus>
  disconnectBrowserProxy(): Promise<BrowserProxyStatus>
  selectBrowserProxy(node: string): Promise<BrowserProxyStatus>
}
