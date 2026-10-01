import { realpath, stat, readFile, readdir } from "node:fs/promises"
import { resolve, relative, isAbsolute, sep } from "node:path"
import { wikiLinkPath } from "@vessel/obsidian"
export async function readWikiLink(root: string, target: string) {
  const base = await realpath(root)
  const requested = wikiLinkPath(target)
  let candidate = resolve(base, requested)
  try { await stat(candidate) } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    if (target.replace(/\\/g, "/").includes("/")) throw new Error("找不到文件：" + target)
    const matches: string[] = []
    const names = /\.(md|markdown|txt)$/i.test(target) ? [target] : [target + ".md", target + ".markdown", target + ".txt"]
    const scan = async (directory: string) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const child = resolve(directory, entry.name)
        if (entry.isDirectory() && ![".git", "node_modules"].includes(entry.name)) await scan(child)
        else if (entry.isFile() && names.includes(entry.name)) matches.push(child)
      }
    }
    await scan(base)
    if (!matches.length) throw new Error("找不到同名文件：" + target)
    if (matches.length > 1) throw new Error("存在多个同名文件，请使用工作区相对路径：" + matches.map(path => relative(base, path)).sort().join("、"))
    candidate = matches[0]
  }
  const path = await realpath(candidate)
  const offset = relative(base, path)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("链接不在工作区")
  const info = await stat(path)
  if (!info.isFile() || info.size > 5 * 1024 * 1024) throw new Error("无法预览该文件（仅支持 5MB 内文本文件）")
  if (!/\.(md|markdown|txt)$/i.test(path)) throw new Error("此链接暂不支持文本预览")
  return { path, content: await readFile(path, "utf8") }
}
