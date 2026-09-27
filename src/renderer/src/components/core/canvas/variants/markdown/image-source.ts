import { parseImageReference } from "@vessel/obsidian"
const language = "vessel-obsidian-image"
/** 将非代码区的图片引用行交给 Vditor 自定义渲染，原始行编码后可无损还原。 */
export function prepareObsidianImages(source: string) {
  let fence = ""
  return source
    .split("\n")
    .map((line) => {
      const marker = /^\s{0,3}(`{3,}|~{3,})/.exec(line)
      if (marker) {
        if (!fence) fence = marker[1]
        else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = ""
        return line
      }
      if (fence || /^ {4}|^\t/.test(line) || line.includes("`")) return line
      if (![...line.matchAll(/!\[\[[^\]\n]+\]\]|!\[[^\]\n]*\]\([^\n]+?\)/g)].some((match) => parseImageReference(match[0]))) return line
      return "\n```" + language + "\n" + encodeURIComponent(line) + "\n```\n"
    })
    .join("\n")
}
export function restoreObsidianImages(source: string) {
  return source.replace(/\n?```vessel-obsidian-image\n([^\n]+)\n```\n?/g, (_match, encoded) => {
    try {
      return decodeURIComponent(encoded)
    } catch {
      return encoded
    }
  })
}
