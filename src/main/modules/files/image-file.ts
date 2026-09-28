import { realpath, stat, readFile } from "node:fs/promises"
import { relative, isAbsolute, sep, extname, basename } from "node:path"
import type { ImageFile } from "../../../shared/image-file"
export async function readImageFile(root: string, path: string): Promise<ImageFile> {
  if (typeof root !== "string" || typeof path !== "string" || !isAbsolute(root) || !isAbsolute(path)) throw new Error("图片路径无效")
  const base = await realpath(root),
    source = await realpath(path),
    offset = relative(base, source)
  if (!offset || offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("图片不在当前工作区")
  const types: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".avif": "image/avif", ".svg": "image/svg+xml" }
  const mime = types[extname(source).toLowerCase()],
    info = await stat(source)
  if (!mime || !info.isFile()) throw new Error("不支持的图片文件")
  if (info.size > 50 * 1024 * 1024) throw new Error("图片超过 50MB")
  return { src: `data:${mime};base64,${(await readFile(source)).toString("base64")}`, name: basename(source), path: source, mime, size: info.size, modifiedAt: info.mtime.toISOString(), createdAt: info.birthtime.toISOString() }
}
