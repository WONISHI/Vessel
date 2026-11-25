import type { BrowserProxyTraffic, BrowserProxySubscriptionInfo } from "@vessel/type"

/** Parse provider-reported byte quotas and Unix expiry; absent values stay unknown. */
export function subscriptionInfo(header: string | null, now = Date.now()): BrowserProxySubscriptionInfo {
  const info: BrowserProxySubscriptionInfo = { updatedAt: now }
  for (const part of (header || "").split(";")) {
    const [field, raw] = part.trim().split("=")
    const key = field.trim().toLowerCase()
    if (!raw?.trim()) continue
    const value = Number(raw)
    if (!Number.isSafeInteger(value) || value < 0) continue
    if (key === "upload") info.uploaded = value
    if (key === "download") info.downloaded = value
    if (key === "total") info.total = value
    if (key === "expire" && value <= 8640000000000) info.expiresAt = value * 1000
  }
  return info
}

export class ProxyTrafficCounter {
  private upload = 0
  private download = 0
  private time: number
  readonly points: BrowserProxyTraffic["history"] = []
  constructor(private lifetimeUpload = 0, private lifetimeDownload = 0, now = Date.now()) { this.time = now }
  sample(upload: number, download: number, now = Date.now()) {
    if (![upload, download, now].every(Number.isFinite) || upload < 0 || download < 0 || now <= this.time) return this.snapshot()
    const up = upload >= this.upload ? upload - this.upload : upload
    const down = download >= this.download ? download - this.download : download
    const seconds = (now - this.time) / 1000
    this.lifetimeUpload += up; this.lifetimeDownload += down
    this.upload = upload; this.download = download; this.time = now
    this.points.push({ time: now, upload: up / seconds, download: down / seconds })
    if (this.points.length > 60) this.points.shift()
    return this.snapshot()
  }
  snapshot(connected = true): BrowserProxyTraffic {
    const point = this.points.at(-1)
    return { uploadRate: connected ? point?.upload || 0 : 0, downloadRate: connected ? point?.download || 0 : 0,
      uploaded: this.upload, downloaded: this.download, totalUploaded: this.lifetimeUpload, totalDownloaded: this.lifetimeDownload, history: this.points.map(point => ({ ...point })) }
  }
}
