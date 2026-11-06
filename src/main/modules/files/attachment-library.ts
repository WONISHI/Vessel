import { readdir, realpath, lstat } from "node:fs/promises"
import { isAbsolute, join, relative, resolve, sep } from "node:path"

export function attachmentFolderOffset(base: string, entry: string) {
  const path = resolve(base, entry.replace(/^~[/\\]?/, ""))
  const offset = relative(base, path)
  if (!offset || isAbsolute(offset) || offset === ".." || offset.startsWith(".." + sep) || /[\[\]#|\r\n]/.test(offset)) return undefined
  return offset
}

export async function listAttachments(root: string, folders: string[]) {
  const base = await realpath(root)
  const visited = new Set<string>()
  const files: { name: string; path: string; size: number; relativePath: string; mtime: number }[] = []

  async function walk(path: string) {
    const directory = await realpath(path).catch(() => undefined)
    if (!directory || !directory.startsWith(base + sep) || visited.has(directory)) return
    visited.add(directory)
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(path)
      } else if (entry.isFile()) {
        const info = await lstat(path).catch(() => undefined)
        if (info?.isFile()) files.push({ name: entry.name, path, size: info.size, mtime: info.mtimeMs, relativePath: relative(base, path) })
      }
    }
  }

  for (const folder of folders) {
    const offset = attachmentFolderOffset(base, folder)
    if (offset) await walk(join(base, offset))
  }
  return files
}
