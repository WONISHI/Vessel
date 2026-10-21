type Edit = { start: number; end: number; lines: string[] }
export const MAX_MERGE_BYTES = 256 * 1024

/** Only merge bounded Markdown prose, never Excalidraw's structured payload. */
export function mergeableMarkdown(path: string, size: number) {
  return /\.(md|markdown)$/i.test(path) && !/\.excalidraw\.md$/i.test(path) && size <= MAX_MERGE_BYTES
}

/** Computes line edits with a bounded LCS matrix; expensive inputs fall back to keep-both. */
function edits(base: string[], target: string[]): Edit[] | undefined {
  // Trim equal edges before allocating the matrix: typing in a large note is usually a tiny diff.
  let prefix = 0
  while (prefix < base.length && prefix < target.length && base[prefix] === target[prefix]) prefix++
  let suffix = 0
  while (suffix < base.length - prefix && suffix < target.length - prefix && base[base.length - suffix - 1] === target[target.length - suffix - 1]) suffix++
  base = base.slice(prefix, base.length - suffix)
  target = target.slice(prefix, target.length - suffix)
  if (!base.length && !target.length) return []
  if (!base.length) return [{ start: prefix, end: prefix, lines: target }]
  if (!target.length) return [{ start: prefix, end: prefix + base.length, lines: [] }]
  if ((base.length + 1) * (target.length + 1) > 2_000_000) return
  const width = target.length + 1
  const matrix = new Uint32Array((base.length + 1) * width)
  for (let i = base.length - 1; i >= 0; i--) for (let j = target.length - 1; j >= 0; j--) {
    matrix[i * width + j] = base[i] === target[j] ? 1 + matrix[(i + 1) * width + j + 1] : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1])
  }
  const result: Edit[] = []
  let i = 0, j = 0, current: Edit | undefined
  while (i < base.length || j < target.length) {
    if (i < base.length && j < target.length && base[i] === target[j]) {
      if (current) { result.push(current); current = undefined }
      i++; j++
    } else {
      current ??= { start: i, end: i, lines: [] }
      if (j < target.length && (i === base.length || matrix[i * width + j + 1] >= matrix[(i + 1) * width + j])) current.lines.push(target[j++])
      else current.end = ++i
    }
  }
  if (current) result.push(current)
  return result.map((edit) => ({ ...edit, start: edit.start + prefix, end: edit.end + prefix }))
}

/** Combines disjoint edits, identical changes and progressive typing without choosing a timestamp winner. */
function mergeSequences(original: string[], local: string[], remote: string[]): string | undefined {
  const left = edits(original, local), right = edits(original, remote)
  if (!left || !right) return
  /** Removes a single trailing line ending for progressive prefix comparison. */
  const trimEnding = (value: string) => value.replace(/\r?\n$/, "")
  const combined = [...left]
  for (const b of right) {
    let duplicate = false
    for (const a of left) {
      if (a.start === b.start && a.end === b.end) {
        const baseChunk = trimEnding(original.slice(a.start, a.end).join("")),
          localChunk = trimEnding(a.lines.join("")),
          remoteChunk = trimEnding(b.lines.join(""))
        if (a.lines.join("") === b.lines.join("") || (localChunk.length > remoteChunk.length && remoteChunk.startsWith(baseChunk) && localChunk.startsWith(remoteChunk))) {
          duplicate = true
          continue
        }
        if (remoteChunk.length > localChunk.length && localChunk.startsWith(baseChunk) && remoteChunk.startsWith(localChunk)) {
          a.lines = b.lines
          duplicate = true
          continue
        }
      }
      // Boundary insertions commute with neighboring replacements; only interior overlaps conflict.
      const overlaps = a.start === a.end && b.start === b.end ? a.start === b.start
        : a.start === a.end ? a.start > b.start && a.start < b.end
        : b.start === b.end ? b.start > a.start && b.start < a.end
        : a.start < b.end && b.start < a.end
      if (overlaps) return
    }
    if (!duplicate) combined.push(b)
  }
  const output = [...original]
  for (const edit of combined.sort((a, b) => b.start - a.start || b.end - a.end)) output.splice(edit.start, edit.end - edit.start, ...edit.lines)
  return output.join("")
}


/** Merges Markdown by lines first, then by Unicode characters for independent edits on the same line. */
export function mergeMarkdown(base: string, local: string, remote: string): string | undefined {
  if ([base, local, remote].some((value) => Buffer.byteLength(value) > MAX_MERGE_BYTES || value.includes("\0"))) return
  if (local === remote) return local
  if (base === local) return remote
  if (base === remote) return local
  const crlf = local.includes("\r\n") && !/(?<!\r)\n/.test(local)
  const normalized = [base, local, remote].map((value) => value.replace(/\r\n/g, "\n"))
  const [ancestor, ours, theirs] = normalized
  let merged: string | undefined
  if (ours === theirs) merged = ours
  else if (ancestor === ours) merged = theirs
  else if (ancestor === theirs) merged = ours
  else {
    /** Splits while retaining the trailing newline as editable content. */
    const lines = (value: string) => value.match(/[^\n]*\n|[^\n]+$/g) ?? []
    merged = mergeSequences(lines(ancestor), lines(ours), lines(theirs))
      ?? mergeSequences(Array.from(ancestor), Array.from(ours), Array.from(theirs))
  }
  return merged === undefined ? undefined : crlf ? merged.replace(/\n/g, "\r\n") : merged
}
