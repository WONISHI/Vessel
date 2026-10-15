import { getFileExtension } from "@vessel/utils"

/** 根据扩展名选择侧栏标签和配色，供文件树行展示使用。
 * @param name 文件名。
 * @returns 显示标签、图标颜色和标签背景样式。
 */
export function getFilePresentation(name: string) {
  const lowerName = name.toLowerCase()
  if (lowerName.endsWith(".excalidraw.md") || lowerName.endsWith(".excalidraw") || lowerName.endsWith(".canvas")) {
    return { label: "DRAW", color: "text-amber-500", badge: "bg-amber-100 text-amber-700" }
  }
  if (lowerName.endsWith(".excalidrawlib")) {
    return { label: "LIB", color: "text-amber-500", badge: "bg-amber-100 text-amber-700" }
  }
  const extension = getFileExtension(name)
  if (["md", "markdown"].includes(extension)) return { label: "MD", color: "text-violet-500", badge: "bg-violet-100 text-violet-600" }
  if (["ts", "tsx"].includes(extension)) return { label: extension.toUpperCase(), color: "text-blue-500", badge: "bg-blue-100 text-blue-600" }
  if (["js", "jsx", "json"].includes(extension)) return { label: extension.toUpperCase(), color: "text-amber-500", badge: "bg-amber-100 text-amber-600" }
  if (extension === "vue") return { label: "Vue", color: "text-green-600", badge: "bg-green-100 text-green-600" }
  return { label: extension.toUpperCase(), color: "text-stone-400", badge: "bg-stone-100 text-stone-500" }
}

import type { WorkspaceNode } from "@/pages/workspace/types/workspace"

export type FileSortBy = "auto" | "ctime" | "name" | "mtime"
export type FileSortOrder = "asc" | "desc"

const CHINESE_DIGITS: Record<string, number> = {
  "零": 0, "〇": 0,
  "一": 1, "壹": 1,
  "二": 2, "两": 2, "貳": 2, "贰": 2, "俩": 2,
  "三": 3, "叁": 3, "参": 3,
  "四": 4, "肆": 4,
  "五": 5, "伍": 5,
  "六": 6, "陆": 6, "陸": 6,
  "七": 7, "柒": 7,
  "八": 8, "捌": 8,
  "九": 9, "玖": 9
}

const CHINESE_UNITS: Record<string, number> = {
  "十": 10, "拾": 10,
  "百": 100, "佰": 100,
  "千": 1000, "仟": 1000,
  "万": 10000, "萬": 10000,
  "亿": 100000000, "億": 100000000
}

const CHINESE_NUM_CHARS = "零〇一壹二两貳贰俩三叁参四肆五伍六陆陸七柒八捌九玖十拾百佰千仟万萬亿億"

/** 解析中文数字字符串（支持一/二/三、壹/贰/叁、十/拾/百/佰/千等）为数值。 */
export function parseChineseNumber(str: string): number | null {
  if (!str) return null
  for (const ch of str) {
    if (!(ch in CHINESE_DIGITS) && !(ch in CHINESE_UNITS)) return null
  }
  const hasUnit = Array.from(str).some((ch) => ch in CHINESE_UNITS)
  if (!hasUnit) {
    if (str.length === 1) return CHINESE_DIGITS[str]
    let val = 0
    for (const ch of str) val = val * 10 + CHINESE_DIGITS[ch]
    return val
  }
  let total = 0
  let section = 0
  let currentDigit = 0
  let hasDigit = false
  for (let i = 0; i < str.length; i++) {
    const ch = str[i]
    if (ch in CHINESE_DIGITS) {
      currentDigit = CHINESE_DIGITS[ch]
      hasDigit = true
    } else if (ch in CHINESE_UNITS) {
      const unit = CHINESE_UNITS[ch]
      if (unit === 10000 || unit === 100000000) {
        section = (section + (hasDigit ? currentDigit : (i === 0 ? 1 : 0))) * unit
        total += section
        section = 0
      } else {
        const val = hasDigit ? currentDigit : (i === 0 || !hasDigit ? 1 : 0)
        section += val * unit
      }
      currentDigit = 0
      hasDigit = false
    }
  }
  if (hasDigit) section += currentDigit
  total += section
  return total
}

export interface SmartSortToken {
  type: "number" | "text"
  val?: number
  raw?: string
  text?: string
}

/** 将文件名拆解为交替的文本块与数字块（支持阿拉伯数字与中文数字）。 */
export function tokenizeFilename(name: string): SmartSortToken[] {
  const tokens: SmartSortToken[] = []
  const regex = new RegExp(`(\\d+|[${CHINESE_NUM_CHARS}]+)`, "g")
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(name)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", text: name.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    if (/^\d+$/.test(raw)) {
      tokens.push({ type: "number", val: parseInt(raw, 10), raw })
    } else {
      const cnNum = parseChineseNumber(raw)
      if (cnNum !== null) {
        tokens.push({ type: "number", val: cnNum, raw })
      } else {
        tokens.push({ type: "text", text: raw })
      }
    }
    lastIndex = regex.lastIndex
  }

  if (lastIndex < name.length) {
    tokens.push({ type: "text", text: name.slice(lastIndex) })
  }

  return tokens
}

/** 智能自然排序比较器：优先匹配相同前缀开头字，随后的数字按数值大小比较。 */
export function compareSmartFileNames(a: string, b: string): number {
  const tokensA = tokenizeFilename(a)
  const tokensB = tokenizeFilename(b)
  const minLen = Math.min(tokensA.length, tokensB.length)

  for (let i = 0; i < minLen; i++) {
    const tA = tokensA[i]
    const tB = tokensB[i]

    if (tA.type === "number" && tB.type === "number") {
      if (tA.val !== undefined && tB.val !== undefined && tA.val !== tB.val) {
        return tA.val - tB.val
      }
      if (tA.raw !== tB.raw && tA.raw && tB.raw) {
        const lenDiff = tA.raw.length - tB.raw.length
        if (lenDiff !== 0) return lenDiff
        const rawDiff = tA.raw.localeCompare(tB.raw, "zh-CN")
        if (rawDiff !== 0) return rawDiff
      }
    } else if (tA.type === "text" && tB.type === "text") {
      const cmp = (tA.text ?? "").localeCompare(tB.text ?? "", "zh-CN", { numeric: true })
      if (cmp !== 0) return cmp
    } else {
      const strA = tA.type === "number" ? tA.raw ?? "" : tA.text ?? ""
      const strB = tB.type === "number" ? tB.raw ?? "" : tB.text ?? ""
      const cmp = strA.localeCompare(strB, "zh-CN", { numeric: true })
      if (cmp !== 0) return cmp
    }
  }

  return tokensA.length - tokensB.length
}

/** 按选择的规则对工作区节点进行排序，默认文件夹置顶。 */
export function sortWorkspaceNodes(
  nodes: WorkspaceNode[],
  sortBy: FileSortBy = "auto",
  sortOrder: FileSortOrder = "asc"
): WorkspaceNode[] {
  return [...nodes].sort((a, b) => {
    // 文件夹始终置顶
    const folderDiff = Number(b.type === "directory") - Number(a.type === "directory")
    if (folderDiff !== 0) return folderDiff

    if (sortBy === "auto") {
      const diff = compareSmartFileNames(a.name, b.name)
      return sortOrder === "desc" ? -diff : diff
    }

    if (sortBy === "ctime") {
      const timeA = a.ctime ?? 0
      const timeB = b.ctime ?? 0
      if (timeA !== timeB) {
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB
      }
      return compareSmartFileNames(a.name, b.name)
    }

    if (sortBy === "mtime") {
      const timeA = a.mtime ?? 0
      const timeB = b.mtime ?? 0
      if (timeA !== timeB) {
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB
      }
      return compareSmartFileNames(a.name, b.name)
    }

    const nameDiff = a.name.localeCompare(b.name, "zh-CN", { numeric: true })
    return sortOrder === "desc" ? -nameDiff : nameDiff
  })
}


