/** New files use the same marker color before and after staging. */
export function gitChangeMarkerClass(status: string): string {
  const value = status.trim()[0]
  return value === "A" || value === "?" ? "text-blue-500" : "text-amber-600"
}

/** Keep the new-file glyph consistent in both lists without changing Git's status. */
export function gitChangeMarker(status: string): string {
  return status.trim() === "A" ? "?" : status
}
