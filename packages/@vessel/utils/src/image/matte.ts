/** Edge-aware guided filtering of a soft alpha matte against original luminance.
 * Tiles include a two-radius halo: both box-filter passes see real neighbours.
 * Memory is bounded by tile size instead of allocating full-resolution float maps.
 */
export function refineMatte(pixels: Uint8ClampedArray, mask: Uint8ClampedArray, width: number, height: number, radius = 4) {
  const result = new Uint8ClampedArray(width * height)
  const r = Math.max(1, Math.min(12, Math.round(radius)))
  const tile = 256,
    epsilon = 0.001
  for (let top = 0; top < height; top += tile)
    for (let left = 0; left < width; left += tile) {
      const x0 = Math.max(0, left - 2 * r),
        y0 = Math.max(0, top - 2 * r)
      const x1 = Math.min(width, left + tile + 2 * r),
        y1 = Math.min(height, top + tile + 2 * r)
      const w = x1 - x0,
        h = y1 - y0,
        n = w * h
      const guide = new Float32Array(n),
        alpha = new Float32Array(n)
      const square = new Float32Array(n),
        product = new Float32Array(n)
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const j = y * w + x,
            i = ((y + y0) * width + x + x0) * 4
          const g = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255
          guide[j] = g
          alpha[j] = mask[i + 3] / 255
          square[j] = g * g
          product[j] = g * alpha[j]
        }
      const meanI = boxMean(guide, w, h, r),
        meanP = boxMean(alpha, w, h, r)
      const meanII = boxMean(square, w, h, r),
        meanIP = boxMean(product, w, h, r)
      for (let j = 0; j < n; j++) {
        const variance = Math.max(0, meanII[j] - meanI[j] ** 2)
        square[j] = (meanIP[j] - meanI[j] * meanP[j]) / (variance + epsilon)
        product[j] = meanP[j] - square[j] * meanI[j]
      }
      const a = boxMean(square, w, h, r),
        b = boxMean(product, w, h, r)
      for (let y = top; y < Math.min(height, top + tile); y++)
        for (let x = left; x < Math.min(width, left + tile); x++) {
          const j = (y - y0) * w + x - x0
          const value = a[j] * guide[j] + b[j]
          // Keep confident interiors exact; only the transition band needs refining.
          const refined = meanP[j] < 0.001 ? 0 : meanP[j] > 0.999 ? 1 : value
          result[y * width + x] = Math.round(Math.max(0, Math.min(1, refined)) * 255)
        }
    }
  return result
}

/** Performs the box mean operation. */
function boxMean(input: Float32Array, width: number, height: number, radius: number) {
  const horizontal = new Float32Array(input.length),
    output = new Float32Array(input.length)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += input[y * width + x]
    for (let x = 0; x < width; x++) {
      horizontal[y * width + x] = sum / (Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1)
      if (x - radius >= 0) sum -= input[y * width + x - radius]
      if (x + radius + 1 < width) sum += input[y * width + x + radius + 1]
    }
  }
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += horizontal[y * width + x]
    for (let y = 0; y < height; y++) {
      output[y * width + x] = sum / (Math.min(height - 1, y + radius) - Math.max(0, y - radius) + 1)
      if (y - radius >= 0) sum -= horizontal[(y - radius) * width + x]
      if (y + radius + 1 < height) sum += horizontal[(y + radius + 1) * width + x]
    }
  }
  return output
}

/** Feather alpha only; optionally pull edge colour from nearby opaque foreground
 * to remove old backdrop contamination without blurring interior image detail. */
export function finishMatte(pixels: Uint8ClampedArray, alpha: Uint8ClampedArray, width: number, height: number, feather = 0, decontaminate = true, shadowCleanup = 0) {
  const widthPx = Math.max(0, Math.min(6, Math.round(feather)))
  const radius = Math.ceil(widthPx / 2)
  const cutoff = Math.max(0, Math.min(100, shadowCleanup)) * 0.008
  const cleaned = Float32Array.from(alpha, (v) => {
    const a = v / 255
    if (!cutoff || a >= cutoff) return a
    // Suppress low-confidence matte haze smoothly, without a hard alpha cutoff.
    const t = Math.max(0, Math.min(1, (a - cutoff * 0.2) / (cutoff * 0.8)))
    return a * t * t * (3 - 2 * t)
  })
  const soft = radius ? boxMean(cleaned, width, height, radius) : cleaned
  // Inward-only feathering: never invent foreground in transparent pixels.
  // PNG decoders may store white/black RGB there, which would become a halo.
  const output = Uint8ClampedArray.from(soft, (v, i) => Math.min(Math.round(cleaned[i] * 255), Math.round(Math.max(0, Math.min(1, v)) * 255)))
  if (!decontaminate) return output
  const original = pixels.slice(),
    reach = Math.max(3, radius * 3 + 1)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x,
        coverage = output[p] / 255
      if (coverage < 0.02 || coverage > 0.98) continue
      let nearest = -1,
        distance = Infinity
      for (let dy = -reach; dy <= reach; dy++)
        for (let dx = -reach; dx <= reach; dx++) {
          const d = dx * dx + dy * dy,
            nx = x + dx,
            ny = y + dy
          if (d >= distance || nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const next = ny * width + nx
          if (output[next] < 254 || alpha[next] < 254) continue
          nearest = next
          distance = d
        }
      if (nearest < 0) continue
      // Softest edge pixels receive the most correction; confident interiors stay exact.
      const weight = (1 - coverage) * 0.9
      for (let c = 0; c < 3; c++) pixels[p * 4 + c] = original[p * 4 + c] * (1 - weight) + original[nearest * 4 + c] * weight
    }
  return output
}
