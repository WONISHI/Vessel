import type { WebContents } from "electron"

/** Resolve icon bytes using the owning guest session; private requests never use normal cookies/cache. */
export async function readBrowserFaviconData(host: WebContents, target: WebContents, url: string, privateSession: boolean): Promise<string | undefined> {
  if (typeof url !== "string" || url.length > 65536 || !/^(https?:\/\/|data:image\/)/i.test(url)) return undefined
  // Reuse the icon already on screen: no second request or canvas CORS access.
  if (!privateSession) try {
    const rect = await host.executeJavaScript(`(() => {
      const image = [...document.querySelectorAll('img[data-browser-favicon]')].find(image => image.src === ${JSON.stringify(url)} && image.complete && image.naturalWidth && getComputedStyle(image).visibility !== 'hidden' && image.getBoundingClientRect().width > 0);
      if (!image) return null;
      const r = image.getBoundingClientRect();
      return {x: Math.floor(r.x), y: Math.floor(r.y), width: Math.ceil(r.width), height: Math.ceil(r.height)};
    })()`)
    if (rect && rect.x >= 0 && rect.y >= 0 && rect.width > 0 && rect.height > 0 && rect.width <= 64 && rect.height <= 64) {
      const image = await host.capturePage(rect)
      if (!image.isEmpty()) return image.toDataURL()
    }
  } catch { /* Hidden/restored tabs can still load the original image below. */ }
  // The tab strip image loads in the host session, while the page uses its own
  // partition/proxy. Race both caches so a slow session cannot block the other.
  const sessions = privateSession ? [target.session] : [...new Set([host.session, target.session])]
  const controller = new AbortController()
  const result = await Promise.any(sessions.map(async iconSession => {
    const response = await iconSession.fetch(url, { cache: "force-cache", credentials: "include", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]) })
    if (!response.ok || Number(response.headers.get("content-length")) > 2 * 1024 * 1024) { await response.body?.cancel(); throw new Error("Invalid favicon response") }
    const reader = response.body?.getReader()
    if (!reader) throw new Error("Empty favicon response")
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > 2 * 1024 * 1024) { await reader.cancel(); break }
      chunks.push(value)
    }
    if (size > 2 * 1024 * 1024) throw new Error("Favicon too large")
    const mime = response.headers.get("content-type")?.split(";")[0].trim() || "image/png"
    if (!/^image\/[a-z0-9.+-]+$/i.test(mime)) throw new Error("Invalid favicon type")
    return `data:${mime};base64,${Buffer.concat(chunks).toString("base64")}`
  })).catch(() => undefined).finally(() => controller.abort())
  if (result) return result
  console.debug("[browser favicon] Could not load icon for color extraction:", url)
  return undefined
}
