import { session } from "electron"

type DictionaryEntry = { word: string; partOfSpeech: string; meanings: string[] }
type TranslationResult = { text: string; detectedLanguage: string; alternatives?: DictionaryEntry[] }
const recent = new Map<string, Promise<TranslationResult>>()
const cacheLimit = 256
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
        const controllers: AbortController[] = []
        const fetchTranslation = async (url: string, primary: boolean) => {
          const controller = new AbortController()
          controllers.push(controller)
          const timeout = setTimeout(() => controller.abort(new DOMException("翻译请求超时", "TimeoutError")), 15000)
          try {
            const response = await browserSession.fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
              body: this.buildBody(), credentials: "omit", signal: controller.signal
            })
            if (!response.ok) {
              if (primary && response.status === 429) {
                const retryAfter = response.headers.get("Retry-After")
                const delay = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Date.parse(retryAfter ?? "") - Date.now()
                primaryRetryAt = Math.max(primaryRetryAt, Date.now() + (delay > 0 ? delay : 60_000))
              }
              await response.body?.cancel()
              throw new TranslationHttpError(response.status)
            }
            const raw: Awaited<ReturnType<InstanceType<typeof Translator>["translate"]>>["raw"] = await response.json()
            const text = this.buildResText(raw)
            if (!text?.trim()) throw new Error("翻译结果为空")
            return { text, raw }
          } finally { clearTimeout(timeout) }
        }
        const backupUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&dt=bd&dj=1"
        let hedgeTimer: ReturnType<typeof setTimeout> | undefined
        try {
          if (Date.now() < primaryRetryAt) return await fetchTranslation(backupUrl, false)
          let startBackup!: () => void
          const backup = new Promise<Awaited<ReturnType<typeof fetchTranslation>>>((resolve, reject) => {
            let started = false
            startBackup = () => {
              if (started) return
              started = true
              clearTimeout(hedgeTimer)
              void fetchTranslation(backupUrl, false).then(resolve, reject)
            }
            hedgeTimer = setTimeout(startBackup, 600)
          })
          const primary = fetchTranslation(this.buildUrl() + "&dt=bd", true).catch((error) => { startBackup(); throw error })
          try { return await Promise.any([primary, backup]) }
          catch (error) {
            if (error instanceof AggregateError) throw error.errors[error.errors.length - 1]
            throw error
          }
        } finally {
          clearTimeout(hedgeTimer)
          controllers.forEach((controller) => controller.abort())
        }
      }
    }

    const result = await new SessionTranslator(text, { from, to }).translate()
    const alternatives = parseTranslationDictionary(result.raw)
    return { text: result.text, detectedLanguage: result.raw.src, ...(alternatives.length ? { alternatives } : {}) }
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

/** Dictionary data is optional: sentence translations may contain no alternatives. */
export function parseTranslationDictionary(raw: unknown): DictionaryEntry[] {
  const groups = (raw as { dict?: unknown } | null)?.dict
  if (!Array.isArray(groups)) return []
  const words = new Map<string, DictionaryEntry>()
  for (const group of groups) {
    if (!group || typeof group !== "object") continue
    const partOfSpeech = typeof group.pos === "string" ? group.pos : ""
    const entries = Array.isArray(group.entry) ? group.entry : Array.isArray(group.terms) ? group.terms.map((word: unknown) => ({ word })) : []
    for (const entry of entries) {
      if (!entry || typeof entry.word !== "string" || !entry.word.trim()) continue
      const word = entry.word.trim()
      const key = `${partOfSpeech}:${word}`
      const meanings = Array.isArray(entry.reverse_translation) ? entry.reverse_translation.filter((value: unknown): value is string => typeof value === "string") : []
      const previous = words.get(key)
      words.set(key, { word, partOfSpeech, meanings: [...new Set([...(previous?.meanings ?? []), ...meanings])] })
    }
  }
  return [...words.values()].slice(0, 30)
}
