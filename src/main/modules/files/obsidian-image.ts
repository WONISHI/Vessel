import { fetchRemoteImage } from "@main/modules/files/save-obsidian-image"
import { parseImageReference, resolveObsidianImagePath } from "@vessel/obsidian"
import { readdir, readFile, realpath, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path"

type AttachmentIndex = { builtAt: number; missRebuildAt: number; pending: Promise<Map<string, string[]>> }
const indexes = new Map<string, AttachmentIndex>()
const IMAGE_FILE = /\.(png|jpe?g|gif|webp|awebp|bmp|svg|avif|jfif)$/i
/** 安全兜底：索引超过该时长后整体重建 */
const INDEX_MAX_AGE = 10 * 60_000
/** 查找未命中时最多每隔该时长重建一次，避免缺图文档反复全量扫描 */
const MISS_REBUILD_INTERVAL = 60_000
/** 单批事件过多（如 git checkout、批量移动）时直接整体失效 */
const BULK_EVENT_LIMIT = 500

/** File watchers discard snapshots on errors or changes the index cannot apply incrementally. */
export function invalidateObsidianImageIndex(root: string) {
  indexes.delete(root)
}

/** Incrementally apply @parcel/watcher create/delete events to an existing per-root index. */
export function applyObsidianImageIndexEvents(root: string, events: ReadonlyArray<{ type: string; path: string }>) {
  const index = indexes.get(root)
  if (!index) return
  const changes = events.filter((event) => event.type === "create" || event.type === "delete")
  if (!changes.length) return
  // 无扩展名的新建项可能是移入的目录（内部图片不会逐个上报），无法增量处理
  if (changes.length > BULK_EVENT_LIMIT || changes.some((event) => event.type !== "create" && event.type !== "delete") || changes.some((event) => event.type === "create" && !extname(event.path))) {
    invalidateObsidianImageIndex(root)
    return
  }
  const pending = index.pending.then((names) => {
    for (const event of changes) {
      const path = relative(root, event.path)
      if (!path || path === ".." || path.startsWith(".." + sep) || isAbsolute(path)) continue
      if (path.split(sep).some((part) => part === ".git" || part === "node_modules")) continue
      const name = basename(path)
      if (event.type === "create") {
        if (!IMAGE_FILE.test(name)) continue
        const matches = names.get(name) ?? []
        if (!matches.includes(path)) matches.push(path)
        names.set(name, matches)
      } else if (IMAGE_FILE.test(name)) {
        const matches = (names.get(name) ?? []).filter((item) => item !== path)
        if (matches.length) names.set(name, matches)
        else names.delete(name)
      } else {
        // 可能删除的是目录：移除其下所有图片
        const prefix = path + sep
        for (const [key, matches] of names) {
          const rest = matches.filter((item) => !item.startsWith(prefix))
          if (rest.length === matches.length) continue
          if (rest.length) names.set(key, rest)
          else names.delete(key)
        }
      }
    }
    return names
  })
  index.pending = pending
  void pending.catch(() => { if (indexes.get(root) === index) indexes.delete(root) })
}

/** Share one scan across concurrent image requests, indexing only matching basenames; afterwards kept up to date by the file watcher. */
function attachmentIndex(base: string): Promise<Map<string, string[]>> {
  const cached = indexes.get(base)
  if (cached && Date.now() - cached.builtAt < INDEX_MAX_AGE) return cached.pending
  const pending = (async () => {
    const names = new Map<string, string[]>()
    const scan = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") await scan(path)
        else if (entry.isFile() && IMAGE_FILE.test(entry.name)) {
          const matches = names.get(entry.name) ?? []
          matches.push(relative(base, path))
          names.set(entry.name, matches)
        }
      }
    }
    await scan(base)
    return names
  })()
  const snapshot: AttachmentIndex = { builtAt: Date.now(), missRebuildAt: 0, pending }
  indexes.delete(base)
  indexes.set(base, snapshot)
  if (indexes.size > 8) indexes.delete(indexes.keys().next().value!)
  void pending.catch(() => { if (indexes.get(base) === snapshot) indexes.delete(base) })
  return pending
}

/** Rebuild after a miss at most once per interval, in case the watcher dropped an event. */
function rebuildAfterMiss(base: string): boolean {
  const cached = indexes.get(base)
  if (cached && Date.now() - Math.max(cached.builtAt, cached.missRebuildAt) < MISS_REBUILD_INTERVAL) return false
  invalidateObsidianImageIndex(base)
  return true
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
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidates = (await attachmentIndex(base)).get(basename(target)) ?? []
    const found = resolveObsidianImagePath(target, relative(base, documentPath), candidates)
    if (!found) {
      if (attempt === 0 && rebuildAfterMiss(base)) continue
      throw new Error("找不到图片：" + embed.target)
    }
    let path: string
    try {
      path = await realpath(resolve(base, found))
    } catch (error) {
      // 索引里的条目已失效（漏掉了删除事件）：重建一次后重试
      if (attempt === 0 && ["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) {
        invalidateObsidianImageIndex(base)
        continue
      }
      throw error
    }
    if (!within(path)) throw new Error("图片不在工作区")
    return path
  }
  throw new Error("找不到图片：" + embed.target)
}

/** 收集 Markdown 中引用的本地图片（去重，跳过远程与找不到的图片），返回工作区内的逻辑路径。 */
export async function collectMarkdownImages(root: string, documentPath: string): Promise<string[]> {
  if (!/\.(md|markdown)$/i.test(documentPath)) return []
  const content = await readFile(documentPath, "utf8")
  const references = content.match(/!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\((?:<[^>\n]+>|[^)\n]+)\)/g) ?? []
  const base = await realpath(root)
  const found = new Set<string>()
  for (const reference of references) {
    try {
      const path = await resolveObsidianImageFile(root, documentPath, reference)
      found.add(join(root, relative(base, path)))
    } catch {
      // 远程、不存在或不在工作区内的图片直接忽略
    }
  }
  return [...found]
}
