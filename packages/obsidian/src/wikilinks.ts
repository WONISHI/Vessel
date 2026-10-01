export interface WikiLink { raw: string; target: string; label: string; heading?: string; index: number }
/** Excludes code, escaped links and image embeds; preserves source offsets. */
export function parseWikiLinks(source: string): WikiLink[] {
  const masked = source.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, value => " ".repeat(value.length))
    .replace(/(`+)[\s\S]*?\1/g, value => " ".repeat(value.length))
  return [...masked.matchAll(/(?<!!)(?<!\\)\[\[([^\]\r\n]+)\]\]/g)].flatMap(match => {
    const [destination, ...alias] = match[1].split("|")
    const [target, ...heading] = destination.trim().split("#")
    if (!target.trim()) return []
    return [{ raw: source.slice(match.index, match.index + match[0].length), target: target.trim(), label: alias.join("|").trim() || target.trim().split(/[\\/]/).pop()!.replace(/\.(md|markdown)$/i, ""), heading: heading.join("#") || undefined, index: match.index }]
  })
}
/** Workspace-root-relative only; never allow absolute paths or parent traversal. */
export function wikiLinkPath(target: string): string {
  const path = target.replace(/\\/g, "/").replace(/^\.\//, "")
  if (!path || /^(\/|[a-z]+:)/i.test(path) || path.split("/").includes("..") || path.includes("\0")) throw new Error("链接路径必须位于当前工作区")
  return /\.[^/]+$/.test(path) ? path : path + ".md"
}
