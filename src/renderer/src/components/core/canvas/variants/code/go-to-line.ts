export function parseLinePosition(value: string, totalLines: number, maxColumn: (line: number) => number) {
  const match = value.match(/^\s*(\d+)\s*(?::\s*(\d+))?\s*$/)
  if (!match) return null
  const lineNumber = Number(match[1]), column = match[2] ? Number(match[2]) : 1
  if (!Number.isSafeInteger(lineNumber) || lineNumber < 1 || lineNumber > totalLines || !Number.isSafeInteger(column) || column < 1 || column > maxColumn(lineNumber)) return null
  return { lineNumber, column }
}
