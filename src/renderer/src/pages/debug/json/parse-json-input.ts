const looksStructured = (text: string) => /^[\s"\\]*[[{]/.test(text)
const isContainer = (value: unknown): value is object => value !== null && typeof value === "object"

/** Decode only the outer transport string; nested field values stay untouched. */
export function parseJsonInput(input: string): unknown {
  const source = input.trim()
  let initial: unknown
  let valid = false
  let originalError: unknown
  try {
    initial = JSON.parse(source)
    valid = true
    if (typeof initial !== "string" || !looksStructured(initial)) return initial
  } catch (error) { originalError = error }
  if (!valid && !looksStructured(source)) throw originalError

  const pending = [valid ? initial as string : source]
  const seen = new Set<string>()
  for (let attempts = 0; pending.length && attempts < 32; attempts++) {
    const text = pending.shift()!.trim()
    if (seen.has(text) || !looksStructured(text)) continue
    seen.add(text)
    try {
      const value: unknown = JSON.parse(text)
      if (isContainer(value)) return value
      if (typeof value === "string" && value !== text) pending.push(value)
      continue
    } catch { /* Try a copied string literal's presentation escapes below. */ }

    // Some debugger/API copies duplicate backslashes before quotes. Do not
    // globally remove slashes: JSON paths, newlines and embedded quotes need them.
    const quotes = text.replace(/(\\{2,})"/g, (match, slashes: string) => slashes.length % 2 === 0 ? "\\".repeat(slashes.length / 2) + '"' : match)
    if (quotes !== text) pending.push(quotes)
    // A copied http\:// scheme is not a valid JSON escape. Restrict this repair
    // to URL schemes in invalid input; valid JSON strings never enter this path.
    const schemes = text.replace(/\b(https?)\\:(?=\/\/)/g, "$1:")
    if (schemes !== text) pending.push(schemes)
    if (text.startsWith('"') && text.endsWith('"')) pending.push(text.slice(1, -1))
    try {
      const decoded: unknown = JSON.parse('"' + text + '"')
      if (typeof decoded === "string" && decoded !== text) pending.push(decoded)
    } catch { /* Malformed JSON remains an error, never executable code. */ }
  }
  if (valid) return initial
  throw originalError
}
