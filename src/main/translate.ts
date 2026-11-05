export async function translateText(text: unknown, from: unknown, to: unknown) {
  if (typeof text !== "string" || !text.trim() || text.length > 5000) {
    throw new Error("请输入 1 到 5000 个字符")
  }
  const languageCode = /^[a-z]{2,3}(?:-[A-Z]{2,4})?$/
  if (typeof from !== "string" || (from !== "auto" && !languageCode.test(from)) || typeof to !== "string" || to === "auto" || !languageCode.test(to)) {
    throw new Error("请选择有效的翻译语言")
  }

  try {
    const { translate } = await import("@vitalets/google-translate-api")
    const result = await translate(text, { from, to, fetchOptions: { signal: AbortSignal.timeout(15000) } })
    return { text: result.text, detectedLanguage: result.raw.src }
  } catch (error) {
    if (error instanceof Error && error.name === "TooManyRequestsError") {
      throw new Error("翻译请求过于频繁，请稍后再试")
    }
    throw new Error("无法连接 Google 翻译，请检查网络后重试")
  }
}
