import type { PDFPageProxy } from "pdfjs-dist"

export type PdfHeading = { text: string; level: number; page: number; offset?: number }
type Line = { text: string; x: number; y: number; end: number; size: number }

export async function readPageTitles(page: PDFPageProxy, number: number, onFontWeights?: (weights: Map<number, number>) => void) {
  const viewport = page.getViewport({ scale: 1 })
  const { items } = await page.getTextContent()
  const lines: Line[] = []
  const weights = new Map<number, number>()

  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue
    const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5])
    const size = Math.round(Math.hypot(item.transform[2], item.transform[3]) * 2) / 2
    if (!size || item.dir === "ttb") continue
    const text = item.str.trim()
    weights.set(size, (weights.get(size) ?? 0) + text.length)
    const last = lines.at(-1)
    if (last && Math.abs(last.y - y) < 2 && Math.abs(last.size - size) < 1 && x >= last.x && x - last.end < size * 2) {
      const gap = x - last.end
      const needsSpace = /^\s/.test(item.str) || gap > size * .22 ||
        (gap > size * .08 && /[\w]$/.test(last.text) && /^[\w]/.test(text))
      last.text += (needsSpace ? " " : "") + text
      last.end = x + item.width
    } else {
      lines.push({ text, x, y, end: x + item.width, size })
    }
  }

  onFontWeights?.(weights)
  const body = [...weights].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0
  const candidates: Line[] = []
  let previous: Line | undefined
  for (const line of lines) {
    const numbered = /^(?:第[一二三四五六七八九十百\d]+[章节篇]|\d+(?:\.\d+)+\s+\S)/.test(line.text)
    const titleLike = line.text.length >= 2 && line.text.length <= 120 && /\p{L}/u.test(line.text) && !/[。；;]$/.test(line.text)
    const prominent = line.size >= body * 1.1 && line.size >= body + .75
    const sparseTitle = lines.length <= 3 && line.size >= 18 && line.y < viewport.height * .4
    if (titleLike && (prominent || numbered || sparseTitle)) {
      const last = candidates.at(-1)
      if (last && previous && Math.abs(last.size - line.size) < 1 && Math.abs(last.x - line.x) < line.size &&
          line.y > previous.y && line.y - previous.y <= line.size * 1.65 && !numbered && last.text.length + line.text.length <= 120) {
        last.text += /[\u3000-\u9fff]$/.test(last.text) && /^[\u3000-\u9fff]/.test(line.text) ? line.text : ` ${line.text}`
      } else {
        candidates.push({ ...line })
      }
      previous = line
    } else {
      previous = undefined
    }
  }
  return candidates.map((line) => ({
    text: line.text,
    page: number,
    size: line.size,
    numbered: /^(?:第[一二三四五六七八九十百\d]+[章节篇]|\d+(?:\.\d+)+\s+\S)/.test(line.text),
    offset: Math.max(0, Math.min(1, (line.y - line.size) / viewport.height))
  }))
}
