import { net, protocol } from "electron"
import { randomUUID } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { resolveObsidianImageFile } from "./obsidian-image"

const resources = new Map<string, string>()
const resourceTokens = new Map<string, string>()
/** Grant an opaque URL only after the existing workspace-bound resolver accepts it. */
export async function createImageResource(root: string, documentPath: string, reference: string) {
  const path = await resolveObsidianImageFile(root, documentPath, reference)
  const info = await stat(path)
  if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("图片超过 20MB 或不是文件")
  const token = resourceTokens.get(path) ?? randomUUID()
  resourceTokens.set(path, token)
  resources.set(token, path)
  return `vessel-image://resource/${token}`
}

/** Stream local bytes through Chromium; URLs cannot supply arbitrary filesystem paths. */
export function registerImageResources() {
  protocol.handle("vessel-image", async (request) => {
    const url = new URL(request.url)
    const path = url.hostname === "resource" ? resources.get(url.pathname.slice(1)) : undefined
    if (!path || !["GET", "HEAD"].includes(request.method)) return new Response(null, { status: 404 })
    try {
      // Recheck the canonical name so a replaced symlink cannot escape its original grant.
      if (await realpath(path) !== path || (await stat(path)).size > 20 * 1024 * 1024) return new Response(null, { status: 403 })
      const response = await net.fetch(pathToFileURL(path).href, { method: request.method })
      const headers = new Headers(response.headers)
      headers.set("Access-Control-Allow-Origin", "*")
      headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
      return new Response(response.body, { status: response.status, headers })
    } catch { return new Response(null, { status: 404 }) }
  })
}
