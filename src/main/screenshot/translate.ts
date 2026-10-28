import { Translator } from "@vitalets/google-translate-api"
import { session } from "electron"

const languages = new Set(["zh-CN", "en", "ja", "ko"])
const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/** Keep the package's request/response logic, using Chromium's proxy-aware transport. */
class SessionTranslator extends Translator {
  override async translate() {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await session.fromPartition("persist:vessel-browser").fetch(this.buildUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: this.buildBody(),
        signal: controller.signal
      })
      if (response.status === 429) throw new Error("翻译请求过于频繁，请稍后重试")
      if (!response.ok) throw new Error(`翻译服务暂不可用（${response.status}）`)
      const raw = await response.json() as Awaited<ReturnType<Translator["translate"]>>["raw"]
      return { text: this.buildResText(raw), raw }
    } catch (error) {
      if (controller.signal.aborted) throw new Error("翻译连接超时，请检查网络或 Vessel 代理后重试")
      throw error
    } finally {
      clearTimeout(timer)
    }
  }
}

export async function translateScreenshot(text: unknown, target: unknown = "zh-CN") {
  if (typeof text !== "string" || !text.trim() || text.length > 100_000) throw new Error("翻译文字需为 1–100000 字")
  if (typeof target !== "string" || !languages.has(target)) throw new Error("不支持的目标语言")
  const key = JSON.stringify([target, text])
  if (cache.has(key)) return cache.get(key)!
  if (pending.has(key)) return pending.get(key)!
  const run = async () => {
    const characters = Array.from(text)
    const chunks: string[] = []
    for (let offset = 0; offset < characters.length; offset += 4000) chunks.push(characters.slice(offset, offset + 4000).join(""))
    const result: string[] = []
    // Bound concurrency to avoid flooding the unofficial service while shortening long OCR waits.
    for (let offset = 0; offset < chunks.length; offset += 2) {
      result.push(...await Promise.all(chunks.slice(offset, offset + 2).map(async (chunk) => {
        const translated = await new SessionTranslator(chunk, { from: "auto", to: target }).translate()
        return translated.text
      })))
    }
    const value = result.join("\n")
    cache.set(key, value)
    if (cache.size > 100) cache.delete(cache.keys().next().value!)
    return value
  }
  const request = run()
  pending.set(key, request)
  try {
    return await request
  } finally {
    pending.delete(key)
  }
}
