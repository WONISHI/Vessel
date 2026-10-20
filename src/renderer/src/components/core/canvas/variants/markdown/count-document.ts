import { parseFrontmatter } from "@vessel/obsidian/frontmatter"

const cjk = String.raw`\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}`
const wordPattern = new RegExp(String.raw`\d+(?:[,.]\d+)*|(?:(?![${cjk}])[-'’\p{L}])+|[${cjk}]`, "gu")

/** Counts note body text with Obsidian-style CJK words and UTF-16 character totals. */
export function countDocument(source: string) {
  const body = parseFrontmatter(source)?.body ?? source
  let words = 0
  wordPattern.lastIndex = 0
  while (wordPattern.exec(body)) words++
  return { words, characters: body.length, lines: body ? body.split(/\r\n|\n|\r/).length : 0 }
}
