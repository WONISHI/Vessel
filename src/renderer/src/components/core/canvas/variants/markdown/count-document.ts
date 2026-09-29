const words = new Intl.Segmenter("zh-CN", { granularity: "word" })
export function countDocument(source: string) {
  let wordCount = 0
  for (const segment of words.segment(source)) if (segment.isWordLike) wordCount++
  return { words: wordCount, characters: Array.from(source).length, lines: source ? source.split(/\r\n|\n|\r/).length : 0 }
}

