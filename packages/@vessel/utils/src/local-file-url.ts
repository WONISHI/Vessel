/** Encode file names without treating #, ? or % as URL syntax. */
export function localFileURL(path: string) {
  const normalized = path.replace(/\\/g, "/")
  const encoded = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/")
  if (/^[a-z]:\//i.test(normalized)) return `file:///${encoded.replace(/^([a-z])%3A/i, "$1:")}`
  if (normalized.startsWith("//")) return `file://${encoded.slice(2)}`
  if (normalized.startsWith("/")) return `file://${encoded}`
  throw new Error("需要绝对文件路径")
}
