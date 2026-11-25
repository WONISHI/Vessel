import { FastAverageColor } from "fast-average-color"

export const DEFAULT_SITE_COLOR = "#16a34a"
const extractor = new FastAverageColor()

/** Transparent pixels do not represent the logo; an unreadable icon keeps the green fallback. */
export async function faviconColor(source?: string): Promise<string> {
  if (!source) return DEFAULT_SITE_COLOR
  try {
    const color = await extractor.getColorAsync(source, { algorithm: "dominant", silent: true })
    return color.error || color.value[3] === 0 ? DEFAULT_SITE_COLOR : color.hex
  } catch { return DEFAULT_SITE_COLOR }
}
