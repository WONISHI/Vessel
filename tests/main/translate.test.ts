import { expect, it, vi } from "vitest"
import { translateText, parseTranslationDictionary } from "@main/translate"

const { fetch, fromPartition } = vi.hoisted(() => {
  const fetch = vi.fn()
  return { fetch, fromPartition: vi.fn(() => ({ fetch })) }
})
vi.mock("electron", () => ({ session: { fromPartition } }))

it("translates through the browser proxy session and parses Google's response", async () => {
  fetch.mockResolvedValueOnce(Response.json({ src: "en", sentences: [{ trans: "你" }] }))

  await expect(translateText("you", "en", "zh-CN")).resolves.toEqual({ text: "你", detectedLanguage: "en" })
  expect(fromPartition).toHaveBeenCalledWith("persist:vessel-browser")
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining("https://translate.google.com/"), expect.objectContaining({
    method: "POST",
    body: "sl=en&tl=zh-CN&q=you",
    credentials: "omit"
  }))
})

it("shares simultaneous translations and reuses the completed result", async () => {
  fetch.mockClear()
  fetch.mockResolvedValueOnce(Response.json({ src: "zh-CN", sentences: [{ trans: "you" }] }))

  const results = await Promise.all([
    translateText("你", "zh-CN", "en"),
    translateText("你", "zh-CN", "en")
  ])
  expect(results.map(({ text }) => text)).toEqual(["you", "you"])
  await expect(translateText("你", "zh-CN", "en")).resolves.toEqual(results[0])
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("falls back to Google's other endpoint on 429 and skips the limited endpoint during cooldown", async () => {
  fetch.mockClear()
  fetch.mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "60" } }))
  fetch.mockResolvedValueOnce(Response.json({ src: "zh-CN", sentences: [{ trans: "Right" }] }))
  fetch.mockResolvedValueOnce(Response.json({ src: "zh-CN", sentences: [{ trans: "Wrong" }] }))

  await expect(translateText("对", "zh-CN", "en")).resolves.toEqual({ text: "Right", detectedLanguage: "zh-CN" })
  await expect(translateText("错", "zh-CN", "en")).resolves.toEqual({ text: "Wrong", detectedLanguage: "zh-CN" })
  expect(fetch).toHaveBeenCalledTimes(3)
  expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("https://translate.googleapis.com/"), expect.objectContaining({ method: "POST" }))
  expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining("https://translate.googleapis.com/"), expect.anything())
})

it("parses dictionary alternatives and merges duplicate words without inventing entries", () => {
  expect(parseTranslationDictionary({ dict: [{ pos: "noun", entry: [
    { word: "translation", reverse_translation: ["翻译", "译文"] },
    { word: "translation", reverse_translation: ["翻译", "转译"] },
    { word: 1 }
  ] }] })).toEqual([{ word: "translation", partOfSpeech: "noun", meanings: ["翻译", "译文", "转译"] }])
  expect(parseTranslationDictionary({ sentences: [] })).toEqual([])
})
