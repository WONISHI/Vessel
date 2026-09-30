export interface ObsidianImageEmbed {
  /** 原始引用，便于无损保留文档。 */
  raw: string
  /** 工作区相对路径或附件名称。 */
  target: string
  alt: string
  width?: number
  height?: number
}
/** 识别 ![[附件.png]]、带路径、别名以及 |300 或 |300x200 的图片嵌入。 */
export function parseObsidianImageEmbed(value: string): ObsidianImageEmbed | null {
  const match = /^!\[\[([^\]\r\n]+)\]\]$/.exec(value.trim())
  if (!match) return null
  const [target, ...options] = match[1].split("|")
  if (!/\.(png|jpe?g|gif|webp|bmp|svg|avif)$/i.test(target.trim())) return null
  const option = options.join("|").trim()
  const size = /^(\d+)(?:x(\d+))?$/.exec(option)
  return { raw: value, target: target.trim(), alt: size || !option ? target.split(/[\\/]/).pop()! : option, ...(size ? { width: Math.max(1, Number(size[1])), ...(size[2] ? { height: Math.max(1, Number(size[2])) } : {}) } : {}) }
}
/** 同时识别 Obsidian 和 Markdown 图片，保留源文本供尺寸回写。 */
export function parseImageReference(value: string): ObsidianImageEmbed | null {
  const wiki = parseObsidianImageEmbed(value)
  if (wiki) return wiki
  const match = /^!\[([^\]\n]*)\]\((<[^>]+>|[^\n]+?)\)$/.exec(value.trim())
  if (!match) return null
  const size = /\|(\d+)(?:x(\d+))?$/.exec(match[1])
  const destination = /^(.*?)(?:\s+(?:"([^"\n]*)"|'([^'\n]*)'))?$/.exec(match[2])!
  const target = destination[1].replace(/^<|>$/g, "")
  return { raw: value, target, alt: size ? match[1].slice(0, size.index) : match[1], ...(size ? { width: Number(size[1]) } : {}) }
}
export function resizeImageReference(reference: string, width: number): string {
  const embed = parseImageReference(reference)
  if (!embed) return reference
  const size = Math.max(1, Math.round(width))
  if (reference.trim().startsWith("![[")) return `![[${embed.target}|${size}]]`
  return reference.replace(/^!\[[^\]]*\]/, `![${embed.alt}|${size}]`)
}
/** 从相对路径集合定位附件：优先文档同目录，再根路径，再按目录距离和路径排序选择同名附件。 */
export function resolveObsidianImagePath(target: string, documentPath: string, candidates: readonly string[]): string | undefined {
  const normalize = (path: string) => path.replace(/\\/g, "/").replace(/^\.\//, "")
  const requested = normalize(target)
  const directory = normalize(documentPath).split("/").slice(0, -1).join("/")
  const local = directory ? directory + "/" + requested : requested
  const paths = candidates.map(normalize)
  if (paths.includes(local)) return local
  if (paths.includes(requested)) return requested
  return paths
    .filter((path) => (requested.includes("/") ? path.endsWith("/" + requested) : path.split("/").pop() === requested))
    .sort((a, b) => {
      const shared = (path: string) => {
        const parts = path.split("/")
        return directory.split("/").findIndex((part, i) => part !== parts[i])
      }
      const score = (path: string) => (shared(path) < 0 ? directory.split("/").length : shared(path))
      return score(b) - score(a) || a.localeCompare(b)
    })[0]
}
