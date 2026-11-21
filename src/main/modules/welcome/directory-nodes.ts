import type { Dirent } from "node:fs"
import { stat } from "node:fs/promises"
import { join } from "node:path"

/** Names and types come from readdir; timestamps require one extra syscall per entry. */
export async function directoryNodes(directory: string, entries: Dirent[], metadata = true) {
  const basic = entries.map(entry => ({ name: entry.name, path: join(directory, entry.name), type: entry.isDirectory() ? "directory" as const : "file" as const }))
  if (!metadata) return basic
  const nodes = await Promise.all(basic.map(async node => {
    try {
      const value = await stat(node.path)
      return { ...node, ctime: value.birthtimeMs > 0 ? value.birthtimeMs : value.ctimeMs, mtime: value.mtimeMs }
    } catch { return { ...node, ctime: 0, mtime: 0 } }
  }))
  return nodes.sort((a, b) => Number(b.type === "directory") - Number(a.type === "directory") || b.ctime - a.ctime || a.name.localeCompare(b.name, "zh-CN", { numeric: true }))
}
