import { createHash } from "node:crypto"
import { mkdtemp, open, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { extensionCrxKey, importExtensionArchive } from "./extension-archive"
import { extensionFile } from "./extension-metadata"

export function webStoreExtensionId(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.hostname !== "chromewebstore.google.com" || url.port || url.username || url.password) return null
    return url.pathname.match(/^\/detail\/(?:[^/]+\/)?([a-p]{32})\/?$/)?.[1] || null
  } catch { return null }
}

export function storeDownloadURL(id: string, chromeVersion: string) {
  if (!/^[a-p]{32}$/.test(id)) throw new Error("扩展 ID 无效")
  const url = new URL("https://clients2.google.com/service/update2/crx")
  url.search = new URLSearchParams({ response: "redirect", prodversion: chromeVersion, acceptformat: "crx3", x: `id=${id}&installsource=ondemand&uc` }).toString()
  return url.href
}

function officialDownload(value: string) {
  const url = new URL(value)
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    ["google.com", "googleusercontent.com", "gvt1.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
}

async function archiveKey(path: string) {
  const file = await open(path, "r")
  try {
    const header = Buffer.alloc(16)
    const first = await file.read(header, 0, 16, 0)
    if (first.bytesRead < 12 || header.subarray(0, 4).toString() !== "Cr24") throw new Error("商店返回的不是 CRX 扩展包")
    const version = header.readUInt32LE(4)
    const size = version === 3 ? 12 + header.readUInt32LE(8) : version === 2 ? 16 + header.readUInt32LE(8) : 0
    if (size < 12 || size > 1024 * 1024) throw new Error("CRX 文件头无效")
    const bytes = Buffer.alloc(size)
    let offset = 0
    while (offset < size) {
      const chunk = await file.read(bytes, offset, size - offset, offset)
      if (!chunk.bytesRead) throw new Error("CRX 文件头不完整")
      offset += chunk.bytesRead
    }
    return extensionCrxKey(bytes)
  } finally { await file.close() }
}

/** Download only from Google's HTTPS endpoints, streaming with a fixed memory/size budget. */
export async function prepareStoreExtension(id: string, storage: string, chromeVersion: string, fetcher: (url: string, init: RequestInit) => Promise<Response>) {
  const temp = await mkdtemp(join(tmpdir(), "vessel-webstore-"))
  let imported: Awaited<ReturnType<typeof importExtensionArchive>> | undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 120000)
  try {
    let url = storeDownloadURL(id, chromeVersion)
    let response: Response | undefined
    for (let redirects = 0; redirects <= 5; redirects++) {
      if (!officialDownload(url)) throw new Error("商店下载跳转到非 Google 地址，已停止")
      response = await fetcher(url, { redirect: "manual", signal: controller.signal })
      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get("location")
      await response.body?.cancel()
      if (!location || redirects === 5) throw new Error("商店下载重定向异常")
      url = new URL(location, url).href
      response = undefined
    }
    if (!response?.ok || !response.body) throw new Error(`商店未提供可下载扩展包（HTTP ${response?.status ?? "未知"}），扩展可能已下架、受限或不兼容当前 Chromium`)
    const maxBytes = 128 * 1024 * 1024
    if (Number(response.headers.get("content-length")) > maxBytes) { await response.body.cancel(); throw new Error("扩展包超过 128 MiB") }
    const archive = join(temp, "extension.crx")
    const file = await open(archive, "w")
    const reader = response.body.getReader()
    let bytes = 0
    try {
      while (true) {
        const next = await reader.read()
        if (next.done) break
        bytes += next.value.byteLength
        if (bytes > maxBytes) throw new Error("扩展包超过 128 MiB")
        await file.writeFile(next.value)
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); await file.close() }
    const key = await archiveKey(archive)
    const actualId = key && createHash("sha256").update(Buffer.from(key, "base64")).digest("hex").slice(0, 32).replace(/[0-9a-f]/g, hex => String.fromCharCode(97 + parseInt(hex, 16)))
    if (actualId !== id) throw new Error("下载包的扩展 ID 与商店页面不一致")
    imported = await importExtensionArchive(archive, storage)
    if (imported.candidates.length !== 1) throw new Error("商店扩展包结构异常")
    const path = imported.candidates[0].path
    const manifest = JSON.parse(await readFile(join(path, "manifest.json"), "utf8"))
    let name = manifest.name as string
    if (/^__MSG_.+__$/.test(name) && typeof manifest.default_locale === "string") {
      try {
        const messages = JSON.parse(await readFile(await extensionFile(path, `_locales/${manifest.default_locale}/messages.json`), "utf8"))
        const key = name.slice(6, -2).toLowerCase()
        const localized = Object.entries(messages).find(([entry]) => entry.toLowerCase() === key)?.[1] as { message?: string } | undefined
        if (localized?.message) name = localized.message
      } catch { /* Use the manifest name when localization is unavailable. */ }
    }
    const permissions = [...(manifest.permissions || []), ...(manifest.host_permissions || [])].filter((value): value is string => typeof value === "string")
    const optional = [...(manifest.optional_permissions || []), ...(manifest.optional_host_permissions || [])].filter((value): value is string => typeof value === "string")
    return { ...imported, path, name, version: manifest.version as string, permissions, optional }
  } catch (error) {
    if (imported) await rm(imported.directory, { recursive: true, force: true })
    if (controller.signal.aborted) throw new Error("商店下载超时，请检查网络后重试")
    throw error
  } finally { clearTimeout(timer); await rm(temp, { recursive: true, force: true }) }
}
