export type BrowserFilePreview = { kind: "document" | "image" } | { kind: "audio" | "video"; mime: string }

/** Conservative allowlist for files Chromium can render locally without an external application. */
export function browserFilePreview(name: string): BrowserFilePreview | undefined {
  const filename = name.replace(/\\/g, "/").split("/").pop() || ""
  const dot = filename.lastIndexOf(".")
  if (dot <= 0) return
  const extension = filename.slice(dot + 1).toLowerCase()
  if (["html", "htm", "xhtml", "pdf", "txt", "text", "log", "json", "xml", "css", "js", "mjs"].includes(extension)) return { kind: "document" }
  if (["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "svg"].includes(extension)) return { kind: "image" }
  const media: Record<string, { kind: "audio" | "video"; mime: string }> = {
    mp3: { kind: "audio", mime: "audio/mpeg" }, wav: { kind: "audio", mime: "audio/wav" },
    ogg: { kind: "audio", mime: "audio/ogg" }, opus: { kind: "audio", mime: "audio/ogg; codecs=opus" },
    m4a: { kind: "audio", mime: "audio/mp4" }, aac: { kind: "audio", mime: "audio/aac" }, flac: { kind: "audio", mime: "audio/flac" },
    mp4: { kind: "video", mime: "video/mp4" }, m4v: { kind: "video", mime: "video/mp4" },
    webm: { kind: "video", mime: "video/webm" }, ogv: { kind: "video", mime: "video/ogg" }, mov: { kind: "video", mime: "video/quicktime" }
  }
  return Object.hasOwn(media, extension) ? media[extension] : undefined
}

/** Show external browser actions only for files supported by the browser preview allowlist. */
export function canOpenInDefaultBrowser(name: string): boolean {
  return !!browserFilePreview(name)
}
