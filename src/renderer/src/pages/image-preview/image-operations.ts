export type ImageSize = { width: number; height: number }
export type ImageRegion = ImageSize & { x: number; y: number }
export function canvasFor(width: number, height: number) {
  width = Math.round(width); height = Math.round(height)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 32_000_000) throw new Error('图片尺寸须在 1–8192 像素内，且不超过 3200 万像素')
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height
  return canvas
}
export async function loadImage(src: string) {
  const image = new Image()
  image.src = src
  await image.decode()
  if (image.naturalWidth * image.naturalHeight > 32_000_000) throw new Error('图片不能超过 3200 万像素')
  return image
}
export async function imageCanvas(src: string) {
  const image = await loadImage(src), canvas = canvasFor(image.naturalWidth, image.naturalHeight)
  canvas.getContext('2d')!.drawImage(image, 0, 0)
  return canvas
}
export function clampRegion(region: ImageRegion, size: ImageSize): ImageRegion {
  const x = Math.max(0, Math.min(size.width - 1, Math.round(region.x) || 0)), y = Math.max(0, Math.min(size.height - 1, Math.round(region.y) || 0))
  return { x, y, width: Math.max(1, Math.min(size.width - x, Math.round(region.width) || 1)), height: Math.max(1, Math.min(size.height - y, Math.round(region.height) || 1)) }
}
export async function cropImage(src: string, region: ImageRegion) {
  const image = await loadImage(src), r = clampRegion(region, { width: image.naturalWidth, height: image.naturalHeight })
  const canvas = canvasFor(r.width, r.height)
  canvas.getContext('2d')!.drawImage(image, r.x, r.y, r.width, r.height, 0, 0, r.width, r.height)
  return canvas
}
export function downloadImage(data: string, name: string) {
  const a = document.createElement('a'); a.href = data; a.download = name; a.click()
}
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  downloadImage(url, name); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
