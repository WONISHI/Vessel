import type { ImageFile } from "@vessel/type"
import { readFile, realpath, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, sep } from "node:path"

function temporaryImageMime(bytes: Buffer): string | undefined {
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png"
  if (bytes.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg"
  const header = bytes.toString("latin1", 0, 16)
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return "image/gif"
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return "image/webp"
  if (header.startsWith("BM") && bytes.length >= 26) return "image/bmp"
  if (header.slice(4, 8) === "ftyp" && ["avif", "avis"].includes(header.slice(8, 12))) return "image/avif"
  return undefined
}

/** Reads image file. */
export async function readImageFile(root: string, path: string): Promise<ImageFile> {
  if (typeof root !== "string" || typeof path !== "string" || !isAbsolute(root) || !isAbsolute(path)) throw new Error("图片路径无效")
  const base = await realpath(root),
    source = await realpath(path),
    offset = relative(base, source)
  if (!offset || offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("图片不在当前工作区")
  const types: Record<string, string> = { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".bmp": "image/bmp", ".avif": "image/avif", ".svg": "image/svg+xml" }
  const extension = extname(source).toLowerCase()
  const info = await stat(source)
  if ((!types[extension] && extension !== ".tmp") || !info.isFile()) throw new Error("不支持的图片文件")
  if (info.size > 50 * 1024 * 1024) throw new Error("图片超过 50MB")
  const bytes = await readFile(source)
  const mime = types[extension] ?? temporaryImageMime(bytes)
  if (!mime) throw new Error("不支持的图片文件")
  return { src: `data:${mime};base64,${bytes.toString("base64")}`, name: basename(source), path: source, mime, size: info.size, modifiedAt: info.mtime.toISOString(), createdAt: info.birthtime.toISOString() }
}
