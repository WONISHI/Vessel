import { cp, lstat, realpath, rename, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, relative, sep } from "node:path"

/** Performs the inside operation. */
const inside = (root: string, path: string) => {
  const value = relative(root, path)
  return value !== ".." && !value.startsWith(".." + sep) && !isAbsolute(value)
}
/** Validate the entire drop before moving/copying anything; never replace an existing entry. */
export async function transferWorkspaceFiles(root: string, paths: string[], destination: string, external: boolean, duplicate = false) {
  const base = await realpath(root),
    directory = await realpath(destination)
  if (!inside(base, directory) || !(await stat(directory)).isDirectory()) throw new Error("目标必须是工作区内的文件夹")
  if (!Array.isArray(paths) || !paths.length || paths.length > 1000) throw new Error("请选择需要移动的文件")
  const sources = [...new Set(await Promise.all(paths.map((path) => realpath(path))))]
  const entries: { source: string; target: string }[] = []
  for (const source of sources.filter((path) => !sources.some((parent) => parent !== path && inside(parent, path)))) {
    if (source === base || (!external && !inside(base, source))) throw new Error("不能移动工作区根目录或工作区以外的文件")
    if (inside(source, directory)) throw new Error("不能将文件夹放入自身或其子文件夹")
    const info = await stat(source)
    if (!info.isFile() && !info.isDirectory()) throw new Error("只支持普通文件和文件夹")
    if (!external && dirname(source) === directory) continue
    let target = join(directory, basename(source))
    if (duplicate && external) {
      const extension = info.isFile() ? extname(source) : ""
      const stem = basename(source).slice(0, basename(source).length - extension.length)
      let suffix = 1
      while (
        await lstat(target).then(
          () => true,
          (error) => {
            if (error.code === "ENOENT") return false
            throw error
          }
        )
      )
        target = join(directory, `${stem} 副本${suffix++ === 1 ? "" : ` ${suffix - 1}`}${extension}`)
    }
    if (
      entries.some((entry) => entry.target === target) ||
      (await lstat(target).then(
        () => true,
        (error) => {
          if (error.code === "ENOENT") return false
          throw error
        }
      ))
    )
      throw new Error(`“${basename(source)}”已存在，未执行此次操作`)
    entries.push({ source, target })
  }
  for (const { source, target } of entries) {
    if (external) await cp(source, target, { recursive: true, force: false, errorOnExist: true, dereference: false })
    else await rename(source, target)
  }
  return entries
}
