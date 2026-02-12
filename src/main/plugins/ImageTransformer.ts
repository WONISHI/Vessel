import fs from "fs/promises"
import path from "path"

/**
 * 配置选项
 */
export interface ImageTransformerOptions {
  /** 启用缓存（默认 true） */
  cache?: boolean
  /** 缓存有效期（毫秒），0 表示永久（默认 60000） */
  cacheTTL?: number
}

/**
 * 缓存条目
 */
interface CacheEntry {
  timestamp: number
  fileMap: Map<string, string>
}

/**
 * 合并映射中的值
 */
interface MergedMapValue {
  /** 文件的绝对路径 */
  fullPath: string
  /** 来源目录路径 */
  sourceDir: string
}

/**
 * Markdown 图片路径转换器（支持多目录）
 */
export class ImageTransformer {
  private cache: boolean
  private cacheTTL: number
  private _cache: Map<string, CacheEntry>

  /**
   * @param options 配置选项
   */
  constructor(options: ImageTransformerOptions = {}) {
    this.cache = options.cache !== false
    this.cacheTTL = options.cacheTTL ?? 60000
    this._cache = new Map()
  }

  /**
   * 转换 Markdown 字符串中的图片路径（仅处理 `![image](path)` 格式）
   * @param markdown - 原始 Markdown 文本
   * @param imageDirs - 图片目录（单个路径或路径数组）
   * @param transformPath - 自定义路径转换函数，返回新路径
   * @returns 转换后的 Markdown 文本
   */
  //
  // prettier-ignore
  public async transform(
    markdown: string,
    imageDirs: string | string[],
    transformPath?: (
      fileName: string,
      originalPath: string,
      fullPath: string,
      sourceDir: string,
    ) => string,
  ): Promise<string> {
    // 1. 统一为数组
    const dirs = Array.isArray(imageDirs) ? imageDirs : [imageDirs]

    // 2. 提取所有 `![image](...)` 中的路径
    const regex = /!\[image\]\((.*?)\)/g
    const matches: string[] = []
    let match: RegExpExecArray | null
    while ((match = regex.exec(markdown)) !== null) {
      matches.push(match[1]) // 原始路径
    }
    if (matches.length === 0) return markdown

    // 3. 获取合并后的文件映射（多目录按顺序优先）
    const mergedMap = await this._getMergedFileMap(dirs)
    if (mergedMap.size === 0) return markdown

    // 4. 执行替换（去重处理）
    const processed = new Set<string>()
    const transformed = markdown.replace(regex, (fullMatch, imgPath) => {
      // 去除查询参数和锚点
      const fileName = path.basename(imgPath).split("?")[0].split("#")[0]
      if (!mergedMap.has(fileName)) return fullMatch

      const { fullPath, sourceDir } = mergedMap.get(fileName)!
      const key = `${imgPath}->${fullPath}`
      if (processed.has(key)) return fullMatch
      processed.add(key)

      let newPath = fullPath // 默认使用绝对路径
      if (typeof transformPath === "function") {
        newPath = transformPath(fileName, imgPath, fullPath, sourceDir)
      }

      return fullMatch.replace(imgPath, newPath)
    })

    return transformed
  }

  /**
   * 获取多个目录合并后的文件映射（同名文件优先取先出现的目录）
   */
  // prettier-ignore
  private async _getMergedFileMap(
    dirs: string[],
  ): Promise<Map<string, MergedMapValue>> {
    const merged = new Map<string, MergedMapValue>()

    for (const dir of dirs) {
      const fileMap = await this._getFileMap(dir)
      for (const [fileName, fullPath] of fileMap.entries()) {
        if (!merged.has(fileName)) {
          merged.set(fileName, { fullPath, sourceDir: dir })
        }
      }
    }

    return merged
  }

  /**
   * 获取单个目录的文件映射（带缓存）
   */
  private async _getFileMap(dirPath: string): Promise<Map<string, string>> {
    const resolved = path.resolve(dirPath)
    const now = Date.now()

    if (this.cache) {
      const cached = this._cache.get(resolved)
      // prettier-ignore
      if (
        cached &&
        (this.cacheTTL === 0 || now - cached.timestamp < this.cacheTTL)
      ) {
        return cached.fileMap
      }
    }

    try {
      const files = await fs.readdir(resolved)
      const fileMap = new Map<string, string>()

      await Promise.all(
        // prettier-ignore
        files.map(async (file) => {
          const full = path.join(resolved, file)
          const stat = await fs.stat(full)
          if (stat.isFile()) {
            fileMap.set(file, full)
          }
        }),
      )

      if (this.cache) {
        this._cache.set(resolved, {
          timestamp: now,
          fileMap,
        })
      }

      return fileMap
    } catch (err) {
      console.error(`[ImageTransformer] 读取目录失败: ${resolved}`, err)
      return new Map()
    }
  }

  /**
   * 清除缓存
   * @param dirPaths - 单个目录或目录数组，不传则清空全部
   */
  public clearCache(dirPaths?: string | string[]): void {
    if (!dirPaths) {
      this._cache.clear()
      return
    }
    const dirs = Array.isArray(dirPaths) ? dirPaths : [dirPaths]
    for (const dir of dirs) {
      this._cache.delete(path.resolve(dir))
    }
  }
}

export default ImageTransformer
