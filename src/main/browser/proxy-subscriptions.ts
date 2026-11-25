import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { randomUUID } from "node:crypto"
import type { BrowserProxySubscription, BrowserProxySubscriptionInfo } from "@vessel/type"

type Codec = { isEncryptionAvailable(): boolean; encryptString(value: string): Buffer; decryptString(value: Buffer): string }
/** Subscription names and token-bearing URLs share the existing OS encrypted storage. */
export class ProxySubscriptions {
  private pending = Promise.resolve()
  private items?: BrowserProxySubscription[]
  constructor(private path: string, private codec: Codec, private legacy: () => Promise<string>) {}
  private async load() {
    if (this.items) return this.items
    if (this.codec.isEncryptionAvailable()) {
      try {
        const value = JSON.parse(this.codec.decryptString(await readFile(this.path)))
        if (Array.isArray(value) && value.every(item => typeof item.id === "string" && typeof item.name === "string" && typeof item.url === "string")) {
          this.items = value
          return this.items!
        }
        throw new Error("订阅数据格式无效")
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
    }
    const url = await this.legacy()
    const items = url ? [{ id: randomUUID(), name: "原有订阅", url }] : []
    if (url) await this.persist(items)
    this.items = items
    return this.items
  }
  private async persist(items: BrowserProxySubscription[]) {
    if (!this.codec.isEncryptionAvailable()) return
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
    const temporary = `${this.path}.tmp`
    await writeFile(temporary, this.codec.encryptString(JSON.stringify(items)), { mode: 0o600 })
    await rename(temporary, this.path)
  }
  private run<T>(action: () => Promise<T>): Promise<T> {
    const result = this.pending.then(action)
    this.pending = result.then(() => {}, () => {})
    return result
  }
  list() { return this.run(async () => (await this.load()).map(item => ({ ...item }))) }
  save(input: { id?: string; name: string; url: string }) {
    return this.run(async () => {
      if (!input || typeof input.name !== "string" || typeof input.url !== "string") throw new Error("订阅名称和地址无效")
      const name = input.name.trim(), url = input.url.trim()
      if (!name || name.length > 80 || url.length > 8192) throw new Error("请填写有效的订阅名称和地址")
      try { if (!["http:", "https:"].includes(new URL(url).protocol)) throw new Error() }
      catch { throw new Error("请输入 HTTP 或 HTTPS 订阅地址") }
      const items = await this.load()
      if (input.id && !items.some(item => item.id === input.id)) throw new Error("订阅不存在")
      if (!input.id && items.length >= 100) throw new Error("最多保存 100 个订阅")
      const item = { id: input.id || randomUUID(), name, url }
      const next = input.id ? items.map(previous => previous.id === input.id ? { ...item, info: previous.url === item.url ? previous.info : undefined } : previous) : [...items, item]
      await this.persist(next)
      this.items = next
      return { ...next.find(previous => previous.id === item.id)! }
    })
  }
  setInfo(id: string, info: BrowserProxySubscriptionInfo, expectedURL?: string) {
    return this.run(async () => {
      const items = await this.load()
      const current = items.find(item => item.id === id)
      if (!current) throw new Error("订阅不存在")
      if (expectedURL && current.url !== expectedURL) throw new Error("订阅地址已更新，请重新刷新信息")
      const item = { ...current, info }
      const next = items.map(previous => previous.id === id ? item : previous)
      await this.persist(next)
      this.items = next
      return { ...item }
    })
  }
  remove(id: string) {
    return this.run(async () => {
      const next = (await this.load()).filter(item => item.id !== id)
      await this.persist(next)
      this.items = next
    })
  }
}
