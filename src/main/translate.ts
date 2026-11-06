import { session } from "electron"

const recent = new Map<string, Promise<{ text: string; detectedLanguage: string }>>()
const cacheLimit = 64
let primaryRetryAt = 0

export async function translateText(text: unknown, from: unknown, to: unknown) {
  if (typeof text !== "string" || !text.trim() || text.length > 5000) {
    throw new Error("请输入 1 到 5000 个字符")
  }
  const languageCode = /^[a-z]{2,3}(?:-[A-Z]{2,4})?$/
  if (typeof from !== "string" || (from !== "auto" && !languageCode.test(from)) || typeof to !== "string" || to === "auto" || !languageCode.test(to)) {
    throw new Error("请选择有效的翻译语言")
  }

  const key = JSON.stringify([from, to, text])
  const cached = recent.get(key)
  if (cached) {
    recent.delete(key)
    recent.set(key, cached)
    return cached
  }

  const request = requestTranslation(text, from, to)
  recent.set(key, request)
  if (recent.size > cacheLimit) recent.delete(recent.keys().next().value!)
  try {
    return await request
  } catch (error) {
    if (recent.get(key) === request) recent.delete(key)
    throw error
  }
}

async function requestTranslation(text: string, from: string, to: string) {
  try {
    const { Translator } = await import("@vitalets/google-translate-api")
    // Keep the library's request format and parser, but use Chromium's proxy-aware transport.
    class SessionTranslator extends Translator {
      override async translate() {
        const browserSession = session.fromPartition("persist:vessel-browser")
        const fetchTranslation = (url: string) => browserSession.fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
          body: this.buildBody(),
          credentials: "omit",
          signal: AbortSignal.timeout(15000)
        })
        let response: Response | undefined
        if (Date.now() >= primaryRetryAt) {
          response = await fetchTranslation(this.buildUrl())
          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After")
            const delay = retryAfter && /^\d+$/.test(retryAfter)
              ? Number(retryAfter) * 1000
              : Date.parse(retryAfter ?? "") - Date.now()
            primaryRetryAt = Math.max(primaryRetryAt, Date.now() + (delay > 0 ? delay : 60_000))
            await response.body?.cancel()
            response = undefined
          }
        }
        response ??= await fetchTranslation("https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dj=1")
        if (!response.ok) {
          await response.body?.cancel()
          throw new TranslationHttpError(response.status)
        }
        const raw: Awaited<ReturnType<InstanceType<typeof Translator>["translate"]>>["raw"] = await response.json()
        return { text: this.buildResText(raw), raw }
      }
    }

    const result = await new SessionTranslator(text, { from, to }).translate()
    return { text: result.text, detectedLanguage: result.raw.src }
  } catch (error) {
    if (error instanceof TranslationHttpError && error.status === 429) {
      throw new Error("翻译请求过于频繁，请稍后再试")
    }
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error("Google 翻译请求超时，请确认代理已连接后重试")
    }
    throw new Error("无法连接 Google 翻译，请检查网络后重试")
  }
}

class TranslationHttpError extends Error {
  constructor(readonly status: number) {
    super(`Google Translate HTTP ${status}`)
  }
}
