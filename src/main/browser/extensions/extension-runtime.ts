import { installExtensionApiShim } from "./extension-api-shim"
import { createHash } from "node:crypto"
import { cp, mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path"

/** Bootstrap managed imports in place to retain their path-derived extension ID; copy external sources with a signed key. */
export async function prepareExtensionRuntime(source: string, cache: string, tabBridgeToken?: string) {
  const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"))
  const background = manifest.background
  if (!background) return source
  const importedOffset = relative(join(dirname(cache), "browser-extension-packages"), source)
  const managed = importedOffset !== ".." && !importedOffset.startsWith(".." + sep) && !isAbsolute(importedOffset)
  // An external unpacked extension without a key would change ID if copied.
  if (!managed && !manifest.key) return source
  const runtime = managed ? source : join(cache, createHash("sha256").update(source).digest("hex").slice(0, 24))
  if (!managed) {
    await mkdir(runtime, { recursive: true })
    await cp(source, runtime, { recursive: true, force: true })
  }
  const legacyShimName = "__vessel_extension_compat.js"
  const shimName = "vessel-extension-compat.js"
  // Chromium rejects reserved filenames even when no manifest entry references them.
  await unlink(join(runtime, legacyShimName)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error })
  const marker = "/* vessel-extension-bootstrap */"
  const endMarker = "/* vessel-extension-bootstrap-end */"
  const shim = `${marker}
;(${installExtensionApiShim.toString()})(${JSON.stringify(tabBridgeToken) ?? "undefined"});
${endMarker}
`
  await writeFile(join(runtime, shimName), shim)
  const within = (file: string) => {
    const path = resolve(runtime, file)
    const offset = relative(runtime, path)
    if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("扩展后台脚本路径无效")
    return path
  }
  if (Array.isArray(background.scripts)) {
    background.scripts = [shimName, ...background.scripts.filter((file: string) => file !== shimName && file !== legacyShimName)]
  } else if (typeof background.page === "string") {
    const file = within(background.page)
    const html = (await readFile(file, "utf8")).replace(/<script\b[^>]*\bsrc=["']\/?(?:__vessel_extension_compat|vessel-extension-compat)\.js["'][^>]*>\s*<\/script>/gi, "")
    const script = `<script src="/${shimName}"></script>`
    await writeFile(file, /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (head) => head + script) : script + html)
  } else if (typeof background.service_worker === "string") {
    const file = within(background.service_worker)
    const original = await readFile(file, "utf8")
    let body = original
    if (original.startsWith(marker)) {
      const end = original.indexOf(endMarker)
      // Earlier versions ended their serialized IIFE immediately before the original worker.
      const legacyEnd = original.indexOf("})();")
      if (end >= 0) body = original.slice(end + endMarker.length).replace(/^\r?\n/, "")
      else if (legacyEnd >= 0) body = original.slice(legacyEnd + "})();".length).replace(/^\r?\n/, "")
      else throw new Error("无法更新扩展兼容脚本")
    }
    await writeFile(file, shim + body)
  }
  // Login/options tabs load their own API clients, independently of the background worker.
  const patchPages = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) await patchPages(path)
      else if (entry.isFile() && /\.html?$/i.test(entry.name)) {
        const original = await readFile(path, "utf8")
        const html = original.replace(/<script\b[^>]*\bsrc=["']\/?(?:__vessel_extension_compat|vessel-extension-compat)\.js["'][^>]*>\s*<\/script>/gi, "")
        const script = `<script src="/${shimName}"></script>`
        const updated = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, (head) => head + script) : script + html
        if (updated !== original) await writeFile(path, updated)
      }
    }
  }
  await patchPages(runtime)
  await writeFile(join(runtime, "manifest.json"), JSON.stringify(manifest, null, 2))
  return runtime
}
