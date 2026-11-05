import { expect, it, vi } from "vitest"
import { translateText } from "@main/translate"

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
