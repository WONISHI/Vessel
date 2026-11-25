import { FastAverageColor } from "fast-average-color"

export const DEFAULT_SITE_COLOR = "#16a34a"
const extractor = new FastAverageColor()
// Exclude transparent pixels and the neutral axis (including near-white/black
// antialiasing), so a favicon's background cannot outvote its colored logo.
const ignoredColor = [
  [0, 0, 0, 0, 32] as [number, number, number, number, number],
  ...Array.from({ length: 17 }, (_, index) => {
    const gray = Math.min(index * 16, 255)
    return [gray, gray, gray, 255, 24] as [number, number, number, number, number]
  })
]

/** Validate cached/external values too, before they reach a menu background. */
export function effectiveSiteColor(color?: string): string {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return DEFAULT_SITE_COLOR
  const channels = [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16))
  return Math.max(...channels) - Math.min(...channels) <= 48 ? DEFAULT_SITE_COLOR : color
}

/** Extract a chromatic logo color; neutral-only and unreadable icons retain green. */
export async function faviconColor(source?: string): Promise<string> {
  if (!source) return DEFAULT_SITE_COLOR
  try {
    const color = await extractor.getColorAsync(source, { algorithm: "dominant", ignoredColor, silent: true })
    return color.error || color.value[3] === 0 ? DEFAULT_SITE_COLOR : effectiveSiteColor(color.hex)
  } catch { return DEFAULT_SITE_COLOR }
}
