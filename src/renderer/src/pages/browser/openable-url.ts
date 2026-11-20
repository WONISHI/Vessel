export function isOpenableUrl(value: string | undefined | null): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    if (url.protocol === "file:") return /\.(html?|xhtml|pdf|svg|png|jpe?g|gif|webp|avif|bmp|ico|txt|md|json|xml|css|js|mjs|csv|mp4|webm|ogv|mov|m4v|mp3|wav|ogg|m4a|aac|flac)$/i.test(decodeURIComponent(url.pathname))
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

/** Localhost webpages are web resources; only file URLs can be revealed on disk. */
export function isLocalFileUrl(value: string | undefined | null): boolean {
  try { return !!value && new URL(value).protocol === "file:" } catch { return false }
}

