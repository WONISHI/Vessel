import { readdir, realpath, stat } from "node:fs/promises"
import { join, relative, isAbsolute, sep } from "node:path"
import { SyncError, type BackupFile } from "./types.js"
export const excludedBackupName = (name: string) =>
  [".vessel", ".git", ".obsidian", ".gut", "node_modules", ".cache", ".DS_Store", "dist", "build", "out", "coverage", ".next", ".nuxt", ".turbo", ".aws", ".ssh", "credentials", "settings.json.tmp"].includes(name) || /^\.env(?:\.|$)/i.test(name) || /\.(?:pem|key|p12|pfx|log)$/i.test(name)

export interface ScanOptions {
  root: string
  selected?: string
  /** Called for every path segment. Defaults to excludedBackupName. */
  exclude?: (name: string) => boolean
  concurrency?: number
  signal?: AbortSignal
}
/** Walk directories in bounded batches, using Dirent data instead of stat/realpath per file. */
export async function collectFiles(options: ScanOptions): Promise<BackupFile[]> {
  options.signal?.throwIfAborted()
  const root = await realpath(options.root)
  const exclude = options.exclude ?? excludedBackupName
  const concurrency = options.concurrency ?? 8
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32) throw new RangeError("scan concurrency must be between 1 and 32")
  const inside = (path: string) => {
    const name = relative(root, path)
    if (!name || name === ".." || name.startsWith(".." + sep) || isAbsolute(name)) throw new SyncError("INVALID_PATH", "只能同步当前工作区内的文件")
    return name.split(sep).join("/")
  }
  if (options.selected) {
    options.signal?.throwIfAborted()
    const source = await realpath(options.selected)
    const path = inside(source)
    if (path.split("/").some(exclude)) throw new SyncError("INVALID_PATH", "该文件被同步排除规则禁止")
    if (!(await stat(source)).isFile()) throw new SyncError("INVALID_PATH", "请选择一个可以同步的文件")
    return [{ path, source }]
  }
  const files: BackupFile[] = [],
    directories = [root]
  for (let cursor = 0; cursor < directories.length;) {
    options.signal?.throwIfAborted()
    const batch = directories.slice(cursor, cursor + concurrency)
    cursor += batch.length
    const results = await Promise.all(
      batch.map(async (directory) => {
        const canonical = await realpath(directory)
        if (canonical !== root) inside(canonical)
        return { directory: canonical, entries: await readdir(canonical, { withFileTypes: true }) }
      })
    )
    for (const { directory, entries } of results)
      for (const entry of entries) {
        if (exclude(entry.name) || entry.isSymbolicLink()) continue
        const source = join(directory, entry.name)
        if (entry.isDirectory()) directories.push(source)
        else if (entry.isFile()) files.push({ path: inside(source), source })
      }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}
