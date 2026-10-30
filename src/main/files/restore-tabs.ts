import { readdir, realpath, stat } from "node:fs/promises"
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path"

/** Recover moved tabs only when there is exactly one matching filename in the workspace. */
export async function restoreWorkspaceTabs(root: string, paths: string[]) {
  if (typeof root !== "string" || !isAbsolute(root) || !Array.isArray(paths) || paths.length > 500) throw new Error("工作区标签无效")
  const base = await realpath(root)
  const within = (path: string) => { const offset = relative(base, path); return offset !== ".." && !offset.startsWith(".." + sep) && !isAbsolute(offset) }
  const result: Record<string, string | null> = {}
  const missing: string[] = []
  for (const path of paths) {
    if (typeof path !== "string" || !isAbsolute(path)) continue
    const logical = resolve(base, relative(root, path))
    if (!within(logical)) { result[path] = null; continue }
    try {
      const file = await realpath(logical)
      result[path] = within(file) && (await stat(file)).isFile() ? path : null
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      result[path] = null
      missing.push(path)
    }
  }
  if (!missing.length) return result
  const wanted = new Set(missing.map((path) => basename(path)))
  const matches = new Map<string, string[]>()
  const scan = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") await scan(join(directory, entry.name))
      else if (entry.isFile() && wanted.has(entry.name)) {
        const found = matches.get(entry.name) || []
        found.push(join(root, relative(base, join(directory, entry.name))))
        matches.set(entry.name, found)
      }
    }
  }
  await scan(base)
  for (const path of missing) {
    const found = matches.get(basename(path))
    if (found?.length === 1) result[path] = found[0]
  }
  return result
}
