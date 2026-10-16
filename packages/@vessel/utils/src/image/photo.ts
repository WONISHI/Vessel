import type { ImageRegion, ImageSize } from "@vessel/utils/image/operations"

// Pixel dimensions are rounded from millimetres at 300 pixels per inch.
export const photoSizes = [
  { id: "one", label: "1寸", width: 25, height: 35 },
  { id: "two", label: "2寸", width: 35, height: 49 },
  { id: "small-one", label: "小1寸", width: 22, height: 32 },
  { id: "large-one", label: "大1寸", width: 33, height: 48 },
  { id: "small-two", label: "小2寸", width: 35, height: 45 },
  { id: "large-two", label: "大2寸", width: 35, height: 53 }
].map((size) => ({ ...size, pixels: { width: Math.round((size.width / 25.4) * 300), height: Math.round((size.height / 25.4) * 300) } }))

/** Performs the fit crop operation. */
export function fitCrop(size: ImageSize, ratio: number, anchor?: { x: number; y: number }, point?: { x: number; y: number }): ImageRegion {
  const a = anchor ?? { x: size.width / 2, y: size.height / 2 }
  if (!point) {
    const width = Math.min(size.width, size.height * ratio),
      height = width / ratio
    return { x: (size.width - width) / 2, y: (size.height - height) / 2, width, height }
  }
  const sx = point.x < a.x ? -1 : 1,
    sy = point.y < a.y ? -1 : 1
  const maxW = sx < 0 ? a.x : size.width - a.x,
    maxH = sy < 0 ? a.y : size.height - a.y
  const width = Math.min(Math.max(Math.abs(point.x - a.x), Math.abs(point.y - a.y) * ratio), maxW, maxH * ratio)
  const height = width / ratio
  return { x: sx < 0 ? a.x - width : a.x, y: sy < 0 ? a.y - height : a.y, width, height }
}

// Replace only the connected background touching the chosen sample. Interior
// areas of the same colour are preserved, unlike global colour substitution.

/** Replaces background. */
export function replaceBackground(data: Uint8ClampedArray, width: number, height: number, sample: { x: number; y: number }, color: string, tolerance: number, smoothing = 1) {
  const start = Math.min(height - 1, Math.max(0, Math.floor(sample.y))) * width + Math.min(width - 1, Math.max(0, Math.floor(sample.x)))
  const offset = start * 4,
    source = Array.from(data.slice(offset, offset + 4))
  const rgb = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))
  const mask = new Uint8Array(width * height),
    visited = new Uint8Array(width * height),
    queue = new Int32Array(width * height)
  let head = 0,
    tail = 1
  queue[0] = start
  visited[start] = 1
  const threshold = Math.max(0, Math.min(100, tolerance)) * 4.4168
  while (head < tail) {
    const pixel = queue[head++],
      i = pixel * 4
    if (!(source[3] < 16 && data[i + 3] < 16) && Math.hypot(data[i] - source[0], data[i + 1] - source[1], data[i + 2] - source[2], data[i + 3] - source[3]) > threshold) continue
    mask[pixel] = 1
    const x = pixel % width,
      y = Math.floor(pixel / width)

    /** Adds add. */
    const add = (next: number) => {
      if (!visited[next]) {
        visited[next] = 1
        queue[tail++] = next
      }
    }
    if (x) add(pixel - 1)
    if (x < width - 1) add(pixel + 1)
    if (y) add(pixel - width)
    if (y < height - 1) add(pixel + width)
  }
  // Estimate foreground coverage in the narrow band next to the connected
  // background. Remove the sampled old backdrop before compositing the new one,
  // so antialiased hair pixels do not retain a red/white fringe.
  const radius = Math.max(0, Math.min(3, Math.round(smoothing)))
  const output = new Uint8ClampedArray(data.length)
  for (let pixel = 0; pixel < width * height; pixel++) {
    const i = pixel * 4,
      x = pixel % width,
      y = Math.floor(pixel / width)
    let coverage = mask[pixel] ? 0 : 1
    if (!mask[pixel] && radius && data[i + 3] > 240 && source[3] > 240) {
      let background = 0,
        count = 0,
        farthest = 0,
        foreground = i
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx,
            ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const p = ny * width + nx,
            j = p * 4
          count++
          background += mask[p]
          const distance = (data[j] - source[0]) ** 2 + (data[j + 1] - source[1]) ** 2 + (data[j + 2] - source[2]) ** 2
          if (!mask[p] && data[j + 3] > 240 && distance > farthest) {
            farthest = distance
            foreground = j
          }
        }
      if (background && farthest > 400) {
        let dot = 0
        for (let c = 0; c < 3; c++) dot += (data[i + c] - source[c]) * (data[foreground + c] - source[c])
        coverage = Math.max(0, Math.min(1, dot / farthest))
        // A small spatial transition also softens genuinely hard pixel steps.
        coverage = Math.min(coverage, 1 - (0.18 * background) / count)
      }
    }
    const opacity = data[i + 3] / 255
    for (let c = 0; c < 3; c++) {
      const replaced = mask[pixel] ? rgb[c] : data[i + c] + (rgb[c] - source[c]) * (1 - coverage)
      output[i + c] = replaced * opacity + rgb[c] * (1 - opacity)
    }
    output[i + 3] = 255
  }
  data.set(output)
}
