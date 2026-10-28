import { expect, it, vi, beforeEach } from "vitest"
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), partition: vi.fn() }))
vi.mock("electron", () => ({ session: { fromPartition: mocks.partition } }))
import { translateScreenshot } from "@main/screenshot/translate"
const response = (text: string) => ({ ok: true, status: 200, json: async () => ({ sentences: [{ trans: text }] }) })
beforeEach(() => { mocks.fetch.mockReset(); mocks.partition.mockReturnValue({ fetch: mocks.fetch }) })
it("uses the browser proxy session and caches repeated successful OCR translations", async () => {
  mocks.fetch.mockResolvedValue(response("你好"))
  expect(await translateScreenshot("Hello proxy", "zh-CN")).toBe("你好")
  expect(mocks.partition).toHaveBeenCalledWith("persist:vessel-browser")
  expect(mocks.fetch.mock.calls[0][1].body).toContain("tl=zh-CN")
  expect(await translateScreenshot("Hello proxy", "zh-CN")).toBe("你好")
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it("splits long OCR results without splitting emoji and preserves order", async () => {
  mocks.fetch.mockResolvedValue(response("translated"))
  expect(await translateScreenshot("😀".repeat(4001), "en")).toBe("translated\ntranslated")
  const first = new URLSearchParams(mocks.fetch.mock.calls[0][1].body).get('q')!
  expect(Array.from(first)).toHaveLength(4000)
  expect(new URLSearchParams(mocks.fetch.mock.calls[1][1].body).get('q')).toBe("😀")
})
it("merges identical in-flight requests", async () => {
  let finish!: Function
  mocks.fetch.mockReturnValue(new Promise((resolve) => { finish = resolve }))
  const first = translateScreenshot("dedupe")
  const second = translateScreenshot("dedupe")
  finish(response("完成"))
  expect(await Promise.all([first, second])).toEqual(["完成", "完成"])
  expect(mocks.fetch).toHaveBeenCalledTimes(1)
})
it("reports timeout clearly and allows retry", async () => {
  vi.useFakeTimers()
  try {
    mocks.fetch.mockImplementation((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))))
    const request = translateScreenshot("timeout")
    const assertion = expect(request).rejects.toThrow("翻译连接超时")
    await vi.advanceTimersByTimeAsync(12000)
    await assertion
    mocks.fetch.mockResolvedValue(response("成功"))
    expect(await translateScreenshot("timeout")).toBe("成功")
  } finally { vi.useRealTimers() }
})
it("rejects empty OCR and explains rate limiting", async () => {
  await expect(translateScreenshot(" ")).rejects.toThrow()
  await expect(translateScreenshot("Hello", "invalid")).rejects.toThrow()
  expect(mocks.fetch).not.toHaveBeenCalled()
  mocks.fetch.mockResolvedValue({ ok: false, status: 429 })
  await expect(translateScreenshot("rate-limit")).rejects.toThrow("过于频繁")
})
