import { createBaseFile, parseBase, queryBase, type BaseFile, type BaseQueryResult } from "@vessel/obsidian/bases"
import { open, readdir, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve, sep } from "node:path"

const propertyCache = new Map<string, { size: number; mtime: number; ctime: number; file: BaseFile }>()

/** Reads a bounded UTF-8 snapshot without allocating an arbitrarily large Markdown file. */
async function readText(path: string): Promise<string> {
  const handle = await open(path, "r")
  try {
    if ((await handle.stat()).size > 8 * 1024 * 1024) throw new Error("文本超过 8 MB，未读取属性")
    return await handle.readFile("utf8")
  } finally {
    await handle.close()
  }
}

/** Queries real vault metadata locally; the renderer receives only the selected table's results. */
export async function queryWorkspaceBase(root: string, path: string, viewIndex?: number): Promise<BaseQueryResult> {
  if (typeof root !== "string" || !isAbsolute(root) || typeof path !== "string" || !path || (viewIndex !== undefined && (!Number.isSafeInteger(viewIndex) || viewIndex < 0))) throw new Error("Base 查询参数无效")
  const base = await realpath(root),
    documentPath = await realpath(resolve(base, path)),
    offset = relative(base, documentPath)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset) || !/\.base$/i.test(documentPath)) throw new Error("Base 文件不在工作区内")
  const source = await readText(documentPath),
    document = parseBase(source)
  viewIndex ??= document.views.findIndex((view) => view.type === "table")
  if (!document.views[viewIndex] || document.views[viewIndex].type !== "table") throw new Error("此视图不是 table 表格视图")
  const paths: string[] = [],
    directories = [base],
    warnings: string[] = []
  let scanned = 0
  while (directories.length) {
    const directory = directories.pop()!
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue
      if (++scanned > 50000) throw new Error("工作区超过 50000 个条目，请缩小工作区后查询")
      const filename = resolve(directory, entry.name)
      if (entry.isDirectory()) directories.push(filename)
      else if (entry.isFile()) paths.push(filename)
    }
  }
  const files: BaseFile[] = []
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(8, paths.length) }, async () => {
      while (next < paths.length) {
        const filename = paths[next++]
        try {
          const info = await stat(filename),
            name = relative(base, filename).split(sep).join("/")
          const cacheKey = base + "\0" + filename
          const cached = propertyCache.get(cacheKey)
          if (cached && cached.size === info.size && cached.mtime === info.mtimeMs && cached.ctime === info.ctimeMs) {
            files.push(cached.file)
            continue
          }
          let content = "",
            readable = true
          if (/\.(md|markdown)$/i.test(filename)) {
            try {
              content = await readText(filename)
            } catch (error) {
              readable = false
              warnings.push(`${name}：${String(error)}`)
            }
          }
          try {
            const file = createBaseFile(name, content, { size: info.size, ctime: info.birthtimeMs, mtime: info.mtimeMs })
            files.push(file)
            if (propertyCache.size >= 50000) propertyCache.delete(propertyCache.keys().next().value!)
            if (readable) propertyCache.set(cacheKey, { size: info.size, mtime: info.mtimeMs, ctime: info.ctimeMs, file })
          } catch (error) {
            warnings.push(`${name}：${String(error)}`)
            files.push(createBaseFile(name, "", { size: info.size, ctime: info.birthtimeMs, mtime: info.mtimeMs }))
          }
        } catch (error) {
          warnings.push(`${relative(base, filename)}：${String(error)}`)
        }
      }
    })
  )
  const documentInfo = await stat(documentPath)
  const result = queryBase(document, files, viewIndex, createBaseFile(offset.split(sep).join("/"), "", { size: documentInfo.size, ctime: documentInfo.birthtimeMs, mtime: documentInfo.mtimeMs }))
  return { ...result, warnings: [...result.warnings, ...warnings.slice(0, 20), ...(warnings.length > 20 ? [`另有 ${warnings.length - 20} 个文件读取提示`] : [])] }
}
