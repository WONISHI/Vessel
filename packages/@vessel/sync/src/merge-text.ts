type Edit = { start: number; end: number; lines: string[] }
export const MAX_MERGE_BYTES = 256 * 1024

/** Only merge bounded Markdown prose, never Excalidraw's structured payload. */
export function mergeableMarkdown(path: string, size: number) {
  return /\.(md|markdown)$/i.test(path) && !/\.excalidraw\.md$/i.test(path) && size <= MAX_MERGE_BYTES
}

/** Computes line edits with a bounded LCS matrix; expensive inputs fall back to keep-both. */
function edits(base: string[], target: string[]): Edit[] | undefined {
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
  return result
}

/** Merges disjoint line edits; overlapping changes are never silently resolved. */
export function mergeMarkdown(base: string, local: string, remote: string): string | undefined {
  if ([base, local, remote].some((value) => Buffer.byteLength(value) > MAX_MERGE_BYTES || value.includes("\0"))) return
  if (local === remote) return local
  if (base === local) return remote
  if (base === remote) return local
  // Keep original line endings and final newline exactly as supplied.
  /** Splits without discarding line endings. */
  const lines = (value: string) => value.match(/[^\n]*\n|[^\n]+$/g) ?? []
  const original = lines(base), left = edits(original, lines(local)), right = edits(original, lines(remote))
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
      // Insertions at replacement boundaries are ambiguous: retain both originals instead.
      const overlaps = a.start === a.end || b.start === b.end
        ? a.start <= b.end && b.start <= a.end
        : a.start < b.end && b.start < a.end
      if (overlaps) return
    }
    if (!duplicate) combined.push(b)
  }
  const output = [...original]
  for (const edit of combined.sort((a, b) => b.start - a.start)) output.splice(edit.start, edit.end - edit.start, ...edit.lines)
  return output.join("")
}
