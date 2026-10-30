import { fetchRemoteImage } from "@main/modules/files/save-obsidian-image"
import { parseImageReference, resolveObsidianImagePath } from "@vessel/obsidian"
import { readdir, readFile, realpath, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"

type AttachmentIndex = { expires: number; pending: Promise<Map<string, string[]>> }
const indexes = new Map<string, AttachmentIndex>()

/** File watchers discard snapshots after additions, removals or renames. */
export function invalidateObsidianImageIndex(root: string) {
  indexes.delete(root)
}

/** Share one scan across concurrent image requests, indexing only matching basenames. */
function attachmentIndex(base: string): Promise<Map<string, string[]>> {
  const cached = indexes.get(base)
  if (cached && cached.expires > Date.now()) return cached.pending
  const pending = (async () => {
    const names = new Map<string, string[]>()
    const scan = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") await scan(path)
        else if (entry.isFile() && /\.(png|jpe?g|gif|webp|awebp|bmp|svg|avif|jfif)$/i.test(entry.name)) {
          const matches = names.get(entry.name) ?? []
          matches.push(relative(base, path))
          names.set(entry.name, matches)
        }
      }
    }
    await scan(base)
    return names
  })()
  const snapshot = { expires: Date.now() + 30_000, pending }
  indexes.delete(base)
  indexes.set(base, snapshot)
  if (indexes.size > 8) indexes.delete(indexes.keys().next().value!)
  void pending.catch(() => { if (indexes.get(base) === snapshot) indexes.delete(base) })
  return pending
}

/** 在工作区内定位附件并返回 data URL；不跟随目录符号链接，也不允许读取根目录以外的文件。 */
export async function readObsidianImage(root: string, documentPath: string, reference: string): Promise<string> {
  const embed = parseImageReference(reference)
  if (!embed) throw new Error("不是有效的 Obsidian 图片引用")
  const base = await realpath(root)

  /** Performs the within operation. */
  const within = (path: string) => {
    const offset = relative(base, path)
    return offset !== ".." && !offset.startsWith(".." + sep) && !isAbsolute(offset)
  }
  if (!within(await realpath(documentPath))) throw new Error("文档不在工作区")
  if (/^https?:/.test(embed.target)) {
    const { bytes, extension } = await fetchRemoteImage(embed.target)
    return `data:image/${extension === "svg" ? "svg+xml" : extension === "jpg" ? "jpeg" : extension};base64,${bytes.toString("base64")}`
  }
  const path = await resolveObsidianImageFile(root, documentPath, reference)
  if ((await stat(path)).size > 20 * 1024 * 1024) throw new Error("图片超过 20MB")
  const mime: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".jfif": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".awebp": "image/webp", ".bmp": "image/bmp", ".svg": "image/svg+xml", ".avif": "image/avif" }
  return "data:" + mime[extname(path).toLowerCase()] + ";base64," + (await readFile(path)).toString("base64")
}

/** Resolve a local attachment with the same workspace bounds as image loading. */
export async function resolveObsidianImageFile(root: string, documentPath: string, reference: string): Promise<string> {
  const embed = parseImageReference(reference)
  if (!embed) throw new Error("不是有效的 Obsidian 图片引用")
  const base = await realpath(root)

  /** Performs the within operation. */
  const within = (path: string) => {
    const offset = relative(base, path)
    return offset !== ".." && !offset.startsWith(".." + sep) && !isAbsolute(offset)
  }
  const canonicalDocument = await realpath(documentPath)
  if (!within(canonicalDocument)) throw new Error("文档不在工作区")
  if (/^(?:https?:|data:|blob:)/i.test(embed.target)) throw new Error("该图片不是本地文件")
  const target = embed.target.replace(/\\/g, "/")
  if (!/\.(png|jpe?g|gif|webp|awebp|bmp|svg|avif|jfif)$/i.test(target)) throw new Error("找不到图片：" + embed.target)
  // Exact references never need a vault scan. Validate canonical paths before returning.
  for (const candidate of [resolve(dirname(canonicalDocument), target), resolve(base, target)]) {
    if (!within(candidate)) continue
    try {
      const path = await realpath(candidate)
      if (within(path) && (await stat(path)).isFile()) return path
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error
    }
  }
  const candidates = (await attachmentIndex(base)).get(basename(target)) ?? []
  const found = resolveObsidianImagePath(target, relative(base, documentPath), candidates)
  if (!found) throw new Error("找不到图片：" + embed.target)
  const path = await realpath(resolve(base, found))
  if (!within(path)) throw new Error("图片不在工作区")
  return path
}
