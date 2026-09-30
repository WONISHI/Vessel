import { realpath, stat, readFile } from "node:fs/promises"
import { resolve, relative, isAbsolute, sep } from "node:path"
import { wikiLinkPath } from "@vessel/obsidian"
export async function readWikiLink(root: string, target: string) {
  const base = await realpath(root)
  const path = await realpath(resolve(base, wikiLinkPath(target)))
  const offset = relative(base, path)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("链接不在工作区")
  const info = await stat(path)
  if (!info.isFile() || info.size > 5 * 1024 * 1024) throw new Error("无法预览该文件（仅支持 5MB 内文本文件）")
  if (!/\.(md|markdown|txt)$/i.test(path)) throw new Error("此链接暂不支持文本预览")
  return { path, content: await readFile(path, "utf8") }
}
