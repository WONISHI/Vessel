import type { JsonShareInfo } from '@vessel/type'
import { randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import { networkInterfaces } from 'node:os'

function lanAddresses(): string[] {
  return [...new Set(Object.values(networkInterfaces()).flatMap(entries => (entries || []).filter(entry => !entry.internal && entry.family === 'IPv4').map(entry => entry.address)))]
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)

type Share = { server: Server; stopped: boolean; ready: Promise<JsonShareInfo>; cancel?: () => void; info?: JsonShareInfo }

/** Each renderer owns one in-memory snapshot. No files or persistent background service are created. */
export class JsonShareService {
  private shares = new Map<string, Share>()
  constructor(private addresses: () => string[] = lanAddresses) {}

  async status(owner: number, document = 'default'): Promise<JsonShareInfo | null> {
    return this.shares.get(`${owner}:${document}`)?.ready.catch(() => null) || null
  }

  start(owner: number, content: unknown, document = 'default'): Promise<JsonShareInfo> {
    const key = `${owner}:${document}`
    const existing = this.shares.get(key)
    if (existing) return existing.ready
    if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content, 'utf8') > 10 * 1024 * 1024) return Promise.reject(new Error('分享内容不能为空，且不能超过 10 MB'))
    try { JSON.parse(content) } catch { return Promise.reject(new Error('请先修正 JSON 语法再分享')) }
    const addresses = this.addresses()
    if (!addresses.length) return Promise.reject(new Error('未找到局域网地址，请连接 Wi-Fi 或有线网络后重试'))
    const token = randomBytes(24).toString('hex')
    const route = '/' + token
    const download = route + '/data.json'
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>JSON 分享 · Vessel</title><style>body{margin:0;background:#f6f7f9;color:#20242c;font:14px system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}header{display:flex;align-items:center;justify-content:space-between;gap:16px}h1{font-size:22px}a{color:#15803d}pre{padding:20px;border:1px solid #e2e4e8;border-radius:12px;background:white;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;tab-size:2}p{color:#737780}</style><main><header><h1>JSON 分享</h1><a href="${download}" download="shared.json">下载 JSON</a></header><p>Vessel 局域网分享 · 只读内容</p><pre>${escapeHtml(content)}</pre></main></html>`
    const share = { stopped: false } as Share
    const server = createServer((request, response) => {
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('X-Content-Type-Options', 'nosniff')
      response.setHeader('Referrer-Policy', 'no-referrer')
      response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'")
      if (share.stopped || ![route, download].includes(request.url || '')) { response.writeHead(404).end('分享不存在或已结束'); return }
      if (!['GET', 'HEAD'].includes(request.method || '')) { response.writeHead(405, { Allow: 'GET, HEAD' }).end(); return }
      const raw = request.url === download
      response.setHeader('Content-Type', raw ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8')
      if (raw) response.setHeader('Content-Disposition', 'attachment; filename="shared.json"')
      response.end(request.method === 'HEAD' ? undefined : raw ? content : html)
    })
    server.requestTimeout = 15_000
    server.headersTimeout = 10_000
    share.server = server
    this.shares.set(key, share)
    share.ready = new Promise<JsonShareInfo>((resolve, reject) => {
      share.cancel = () => reject(new Error('分享已取消'))
      server.on('error', error => {
        if (this.shares.get(key) === share) this.shares.delete(key)
        share.stopped = true
        server.closeAllConnections()
        server.close()
        reject(error)
      })
      server.listen(0, '0.0.0.0', () => {
        if (share.stopped) { server.close(); reject(new Error('分享已取消')); return }
        const address = server.address()
        if (!address || typeof address === 'string') { this.stop(owner, document); reject(new Error('无法创建局域网分享')); return }
        share.info = { urls: addresses.map(ip => `http://${ip}:${address.port}${route}`), startedAt: Date.now() }
        server.unref()
        resolve(share.info)
      })
    })
    return share.ready
  }

  stop(owner: number, document = 'default'): void { this.stopKey(`${owner}:${document}`) }

  stopOwner(owner: number): void {
    for (const key of this.shares.keys()) if (key.startsWith(`${owner}:`)) this.stopKey(key)
  }

  private stopKey(key: string): void {
    const share = this.shares.get(key)
    if (!share) return
    this.shares.delete(key)
    share.stopped = true
    share.cancel?.()
    share.server.closeAllConnections()
    share.server.close()
  }

  dispose(): void { for (const key of this.shares.keys()) this.stopKey(key) }
}
