import { readFile, realpath, stat } from "node:fs/promises"
import { resolve, relative, isAbsolute } from "node:path"
import type { BrowserExtension } from "../shared/browser-extensions"

export async function extensionFile(root: string, path: string) {
  const base = await realpath(root)
  const target = await realpath(resolve(base, path))
  const rel = relative(base, target)
  if (rel.startsWith("..") || isAbsolute(rel)) throw new Error("扩展资源路径超出目录")
  return target
}
export async function extensionMetadata(record: BrowserExtension) {
  const manifest = JSON.parse(await readFile(await extensionFile(record.path, "manifest.json"), "utf8"))
  const action = manifest.action || manifest.browser_action || manifest.page_action || {}
  record.popup = typeof action.default_popup === "string" ? action.default_popup : undefined
  record.optionsPage = manifest.options_ui?.page || manifest.options_page
  record.devtoolsPage = manifest.devtools_page
  record.permissions = [...(manifest.permissions || []), ...(manifest.host_permissions || [])].filter((p: unknown) => typeof p === "string")
  record.icon = undefined
  const icons = action.default_icon || manifest.icons || {}
  const path = typeof icons === "string" ? icons : Object.entries(icons).sort(([a], [b]) => Math.abs(Number(a) - 48) - Math.abs(Number(b) - 48))[0]?.[1]
  if (typeof path === "string") {
    try {
      const file = await extensionFile(record.path, path)
      if ((await stat(file)).size > 1024 * 1024) return
      const bytes = await readFile(file)
      // Only inert raster formats are exposed to the renderer.
      const mime = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png" : bytes[0] === 255 && bytes[1] === 216 ? "image/jpeg" : undefined
      if (mime) record.icon = `data:${mime};base64,${bytes.toString("base64")}`
    } catch { /* Missing icons use the puzzle fallback. */ }
  }
}
