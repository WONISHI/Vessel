import { session } from "electron"

export async function translateText(text: unknown, from: unknown, to: unknown) {
  if (typeof text !== "string" || !text.trim() || text.length > 5000) {
    throw new Error("请输入 1 到 5000 个字符")
  }
  const languageCode = /^[a-z]{2,3}(?:-[A-Z]{2,4})?$/
  if (typeof from !== "string" || (from !== "auto" && !languageCode.test(from)) || typeof to !== "string" || to === "auto" || !languageCode.test(to)) {
    throw new Error("请选择有效的翻译语言")
  }

  try {
    const { Translator } = await import("@vitalets/google-translate-api")
    // Keep the library's request format and parser, but use Chromium's proxy-aware transport.
    class SessionTranslator extends Translator {
      override async translate() {
        const response = await session.fromPartition("persist:vessel-browser").fetch(this.buildUrl(), {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
          body: this.buildBody(),
          credentials: "omit",
          signal: AbortSignal.timeout(15000)
        })
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
