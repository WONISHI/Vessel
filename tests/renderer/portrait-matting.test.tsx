// @vitest-environment jsdom
import { expect, it, vi, afterEach } from "vitest"
import { portraitBackground } from "@/lib/image/portrait-matting"
const mocks = vi.hoisted(() => ({ remove: vi.fn() }))
vi.mock("@/lib/image/background-removal", () => ({ removeImageBackground: mocks.remove }))
vi.mock("@vessel/utils/image/operations", async (original) => ({ ...(await original<object>()), loadImage: vi.fn(async () => ({ naturalWidth: 2, naturalHeight: 2 })), imageCanvas: vi.fn(async () => ({ toBlob: (callback) => callback(new Blob(["input"], { type: "image/png" })) })) }))
afterEach(() => vi.unstubAllGlobals())
it("uses IS-Net without requiring WebGPU, preserves soft alpha, and releases temporary resources", async () => {
  const progress = vi.fn(),
    revoke = vi.fn()
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "blob:cutout" })
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke })
  mocks.remove.mockImplementation(async (_src, _path, progress) => {
    progress("正在读取本地换底资源：40.0 / 80.0 MB")
    return new Blob()
  })
  const data = new Uint8ClampedArray([20, 20, 20, 0, 20, 20, 20, 128, 20, 20, 20, 255, 20, 20, 20, 64])
  const context = { fillStyle: "", globalCompositeOperation: "", fillRect: vi.fn(), drawImage: vi.fn(), getImageData: () => ({ data }), putImageData: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D)
  const canvas = await portraitBackground("source", "#123456", progress, { feather: 0, decontaminate: false, shadowCleanup: 0 })
  expect(mocks.remove).toHaveBeenCalledWith(expect.any(Blob), new URL("vendor/imgly/1.7.0/", document.baseURI).href, progress)
  expect(canvas.width).toBe(2)
  expect(canvas.height).toBe(2)
  expect([data[3], data[7], data[11], data[15]]).toEqual([0, 128, 255, 64])
  expect(context.fillStyle).toBe("#123456")
  expect(progress).toHaveBeenCalledWith(expect.stringContaining("40.0 / 80.0"))
  expect(revoke).toHaveBeenCalledWith("blob:cutout")
})
it("propagates model failures without returning a modified image", async () => {
  mocks.remove.mockRejectedValue(new Error("download failed"))
  await expect(portraitBackground("source", "#fff", vi.fn())).rejects.toThrow("download failed")
})
