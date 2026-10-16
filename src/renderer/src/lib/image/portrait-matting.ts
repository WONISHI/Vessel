import { finishMatte } from "@vessel/utils/image/matte"
import { canvasFor, imageCanvas, loadImage } from "@vessel/utils/image/operations"

/** IMG.LY IS-Net (AGPL-3.0). Runtime/model assets are bundled with the application;
 * all resources and source photos remain on the device. Loaded on explicit user action. */
export async function portraitBackground(src: string, color: string, progress: (text: string) => void, options: { feather?: number; decontaminate?: boolean; shadowCleanup?: number } = {}): Promise<HTMLCanvasElement> {
  progress("正在加载 IS-Net 换底引擎…")
  const { removeImageBackground } = await import("@/lib/image/background-removal")
  const inputCanvas = await imageCanvas(src)
  const input = await new Promise<Blob>((resolve, reject) => inputCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("无法读取待换底图片"))), "image/png"))
  const foreground = await removeImageBackground(input, new URL("vendor/imgly/1.7.0/", document.baseURI).href, progress)
  const url = URL.createObjectURL(foreground)
  try {
    progress("正在合成背景与柔化边缘…")
    const [cutout, source] = await Promise.all([loadImage(url), loadImage(src)])
    if (cutout.naturalWidth !== source.naturalWidth || cutout.naturalHeight !== source.naturalHeight) throw new Error("换底引擎返回尺寸不一致，未修改原图")
    const canvas = canvasFor(source.naturalWidth, source.naturalHeight),
      ctx = canvas.getContext("2d")!
    ctx.drawImage(cutout, 0, 0)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const alpha = new Uint8ClampedArray(canvas.width * canvas.height)
    for (let i = 0; i < alpha.length; i++) alpha[i] = pixels.data[i * 4 + 3]
    // Use the engine's matte directly; do not force it through the old MODNet filter.
    const finished = finishMatte(pixels.data, alpha, canvas.width, canvas.height, options.feather ?? 0, options.decontaminate ?? true, options.shadowCleanup ?? 50)
    for (let i = 0; i < finished.length; i++) pixels.data[i * 4 + 3] = finished[i]
    ctx.putImageData(pixels, 0, 0)
    ctx.globalCompositeOperation = "destination-over"
    ctx.fillStyle = color
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.globalCompositeOperation = "source-over"
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}
