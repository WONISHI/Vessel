/** Recognize explicit web addresses and emails without changing their displayed/source text. */
export function parseTextLinks(text: string) {
  const pattern = /https?:\/\/[^\s<>"'，。；！？、]+|mailto:[\w.!#$%&'*+/=?^`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}|\bwww\.[a-z\d.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"'，。；！？、]*)?|[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,}/gi
  return Array.from(text.matchAll(pattern)).flatMap((match) => {
    let value = match[0].replace(/[.,;:!，。；！？、）】》」』]+$/u, "")
    for (const [open, close] of [["(", ")"], ["[", "]"]]) {
      while (value.endsWith(close) && value.split(close).length > value.split(open).length) value = value.slice(0, -1)
    }
    const href = /^https?:|^mailto:/i.test(value) ? value : /^www\./i.test(value) ? `https://${value}` : `mailto:${value}`
    try {
      const url = new URL(href)
      if (!value || (url.protocol !== "mailto:" && !url.hostname)) return []
      return [{ index: match.index!, text: value, href }]
    } catch { return [] }
  })
}
